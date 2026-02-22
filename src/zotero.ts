import * as fs from 'fs/promises';
import * as vscode from 'vscode';
import initSqlJs, { Database } from 'sql.js';
import {
    queryItems,
    queryZoteroKey,
    queryOpenOptions
} from './queries';
import {
    handleError,
    extractYear,
    formatTypes
} from './helpers';


export class ZoteroDatabase {
    private zoteroDbPath: string;

    private db: Database | null = null;

    constructor(zoteroDbPath: string) {
        this.zoteroDbPath = zoteroDbPath;
    }

    /**
     * Connect to Zotero and Better BibTeX databases
     */
    public async connect(): Promise<boolean> {
        try {
            const SQL = await initSqlJs();

            const zoteroDbFile = await fs.readFile(this.zoteroDbPath);
            this.db = new SQL.Database(zoteroDbFile);

            return true;
        } catch (error) {
            if (error instanceof Error) {
                if ('code' in error && error.code === 'ENOENT') {
                    const filePath = 'path' in error ? (error as any).path : '';
                    vscode.window.showErrorMessage(`Database file not found at ${filePath}`);
                } else {
                    handleError(error, `Failed to connect to databases`);
                }
            } else {
                handleError(new Error(String(error)), `Failed to connect to databases`);
            }
            return false;
        }
    }

    public async connectIfNeeded() {
        if (!this.isConnected()) {
            const connected = await this.connect();
            if (!connected) {
                vscode.window.showErrorMessage('Failed to connect to Zotero database');
                return;
            }
        }
    }

    public isConnected(): boolean {
        return this.db !== null;
    }

    /**
     * Get items from Zotero database (Legacy Better BibTeX only)
     */
    public async getItems(): Promise<any[]> {
        if (!this.db) {
            vscode.window.showErrorMessage('Database not connected');
            return [];
        }

        try {
            const itemRows = this.getValues(this.db.exec(queryItems));
            return itemRows.map(({ creators, date, ...rest }) => ({
                ...rest,
                date,
                year: extractYear(date || ''),
                creators: (JSON.parse(creators) as any[])
                    .sort((a, b) => a.orderIndex - b.orderIndex)
            }));
        } catch (error) {
            handleError(error, `Error querying database`);
            return [];
        }
    }

    public async getOpenOptions(citeKey: string): Promise<any[] | null> {
        if (!this.db) {
            vscode.window.showErrorMessage('Database not connected');
            return null;
        }

        const matches = this.getValues(this.db.exec(queryZoteroKey(citeKey)));

        if (matches.length === 0) {
            vscode.window.showErrorMessage(`Could not find Zotero item for ${citeKey}`);
            return null;
        }

        let { zoteroKey, libraryID } = matches[0];

        if (matches.length > 1) {
            const quickPickItems = matches.map(m => ({
                label: `${formatTypes(m.typeName)} ${m.title}`,
                detail: m.libraryName || 'My Library',
                zoteroKey: m.zoteroKey,
                libraryID: m.libraryID
            }));

            const selected = await vscode.window.showQuickPick(quickPickItems, {
                placeHolder: `Multiple items found for @${citeKey}. Please select one:`,
                matchOnDescription: true,
                matchOnDetail: true
            });
            if (!selected) { return null; }
            zoteroKey = selected.zoteroKey;
            libraryID = selected.libraryID;
        }

        const openOptions = this.getFirstValue(
            this.db.exec(queryOpenOptions(zoteroKey, libraryID))
        );
        if (!openOptions) {
            return null;
        }
        const { groupID, pdfKey, doi } = openOptions;

        const options: any[] = [{ type: 'zotero', key: zoteroKey, groupID }];
        if (pdfKey) { options.push({ type: 'pdf', key: pdfKey, groupID }); }
        if (doi) { options.push({ type: 'doi', key: doi }); }

        return options;
    }

    public close(): void {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }

    private getFirstValue(sqlResult: initSqlJs.QueryExecResult[]): any | null {
        if (sqlResult.length === 0 || sqlResult[0].values.length === 0) {
            return null;
        }
        return this.getValues(sqlResult)[0];
    }

    private getValues(sqlResult: initSqlJs.QueryExecResult[]): any[] {
        if (sqlResult.length === 0) { return []; }

        const { columns, values } = sqlResult[0];
        return values.map(row =>
            Object.fromEntries(columns.map((col, i) => [col, row[i]]))
        );
    }
}