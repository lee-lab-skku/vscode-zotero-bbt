import * as fs from 'fs/promises';
import * as vscode from 'vscode';
import initSqlJs, { Database } from 'sql.js';
import {
    queryBbt,
    queryItems,
    queryCreators,
    queryPdfByZoteroKey,
    queryDoiByZoteroKey,
    queryGroupIDByLibraryID,
    queryGroupItemsByZoterokey,
    queryZoteroKey
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
            const bbtRows     = this.getValues(this.db.exec(queryBbt));
            const itemRows    = this.getValues(this.db.exec(queryItems));
            const creatorRows = this.getValues(this.db.exec(queryCreators));

            const bbtCitekeys: Record<string, string> = Object.fromEntries(
                bbtRows.map(({ zoteroKey, citeKey }) => [zoteroKey, citeKey])
            );

            const rawItems: Record<string, any> = {};
            for (const { zoteroKey, fieldName, value, typeName, libraryID } of itemRows) {
                if (!rawItems[zoteroKey]) {
                    rawItems[zoteroKey] = { zoteroKey, creators: [] };
                }
                rawItems[zoteroKey][fieldName] = value;
                rawItems[zoteroKey].itemType = typeName;
                rawItems[zoteroKey].libraryID = libraryID;
            }

            for (const { zoteroKey, orderIndex, firstName, lastName, creatorType } of creatorRows) {
                if (rawItems[zoteroKey]) {
                    rawItems[zoteroKey].creators[orderIndex] = { firstName, lastName, creatorType };
                }
            }

            return Object.entries(rawItems)
                .filter(([zoteroKey]) => bbtCitekeys[zoteroKey])
                .map(([zoteroKey, item]) => ({
                    ...item,
                    citeKey: bbtCitekeys[zoteroKey],
                    year: extractYear(item.date || '')
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

        const sqlZoteroKey = this.db.exec(queryZoteroKey(citeKey));
        
        // handle non-existent citeKey
        if (sqlZoteroKey.length === 0) {
            vscode.window.showErrorMessage(`Could not find Zotero item for ${citeKey}`);
            return null;
        }

        let groupID = null;
        let zoteroKey = this.getFirstValue(sqlZoteroKey)['zoteroKey'];
        let libraryID = this.getFirstValue(sqlZoteroKey)['libraryID'];

        // if there are multiple results with the same citeKey, show picker to select one
        if (sqlZoteroKey[0].values.length > 1) {
            // use queryGroupItemsByZoterokey to get items by zoteroKey and libraryID
            // then show picker to select one
            const quickPickItems = this.getValues(sqlZoteroKey).map(result => {
                const sqlItem = this.db?.exec(queryGroupItemsByZoterokey(result.zoteroKey, result.libraryID));
                const item = this.getFirstValue(sqlItem!);
                const icon = formatTypes(item.typeName);
                const libraryName = item.libraryName || 'My Library';

                return {
                    label: `${icon} ${item.title}`,
                    item: item,
                    detail: `${libraryName}`
                };
            });

            let selected = await vscode.window.showQuickPick(quickPickItems, {
                placeHolder: `Multiple items found for @${citeKey}. Please select one:`,
                matchOnDescription: true,
                matchOnDetail: true
            });
            if (!selected) {
                // open cancelled
                return null;
            }
            zoteroKey = selected.item.zoteroKey;
            libraryID = selected.item.libraryID;
        }

        if (libraryID !== 1) {
            const sqlGroup = this.db.exec(queryGroupIDByLibraryID(libraryID));
            groupID = this.getFirstValue(sqlGroup)['groupID'];
        }

        const options = [];
        options.push({ type: 'zotero', key: zoteroKey, groupID: groupID });

        const sqlPdf = this.db.exec(queryPdfByZoteroKey(zoteroKey, libraryID));
        if (sqlPdf.length > 0) {
            const pdfKey = this.getFirstValue(sqlPdf)['pdfKey'];

            if (pdfKey) {
                options.push({ type: 'pdf', key: pdfKey, groupID: groupID });
            }
        }

        const sqlDoi = this.db.exec(queryDoiByZoteroKey(zoteroKey, libraryID));
        if (sqlDoi.length > 0) {
            const doi = this.getFirstValue(sqlDoi)['value'];

            if (doi) {
                options.push({ type: 'doi', key: doi });
            }
        }
        
        return options;
    }

    public close(): void {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }

    /**
     * Get the first value from a SQL result set.
     * @param sqlResult The SQL result set.
     * @param columnName The name of the column to retrieve the value from.
     * @returns The first value in the specified column, or null if not found.
     */
    private getFirstValue(sqlResult: initSqlJs.QueryExecResult[]): any | null {
        if (sqlResult.length === 0) {
            return null;
        }
        return this.getValues(sqlResult)[0];
    }

    private getValues(sqlResult: initSqlJs.QueryExecResult[]): any[] {
        if (sqlResult.length === 0) {return [];}
        
        const { columns, values } = sqlResult[0];
        return values.map(row => 
            Object.fromEntries(columns.map((col, i) => [col, row[i]]))
        );
    }
}