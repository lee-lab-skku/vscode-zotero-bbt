import * as fs from 'fs/promises';
import * as vscode from 'vscode';
import initSqlJs, { Database } from 'sql.js';
import {
    queryBbt,
    queryItems,
    queryZoteroKey,
    queryPdfByZoteroKey,
    queryDoiByZoteroKey
} from './queries';
import {
    handleError,
    extractYear
} from './helpers';

interface DatabaseOptions {
    zoteroDbPath: string;
    betterBibtexDbPath: string;
}

export class ZoteroDatabase {
    private options: DatabaseOptions;
    private db: Database | null = null;
    private bbt: Database | null = null;

    constructor(options: DatabaseOptions) {
        this.options = options;
    }

    /**
     * Connect to Zotero and Better BibTeX databases
     */
    public async connect(): Promise<boolean> {
        try {
            // Check if files exist
            await fs.access(this.options.zoteroDbPath);
            await fs.access(this.options.betterBibtexDbPath);

            const SQL = await initSqlJs();
            const zoteroDbFile = await fs.readFile(this.options.zoteroDbPath);
            const bbtDbFile = await fs.readFile(this.options.betterBibtexDbPath);

            this.db = new SQL.Database(zoteroDbFile);
            this.bbt = new SQL.Database(bbtDbFile);

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
        if (!this.db || !this.bbt) {
            const connected = await this.connect();
            if (!connected) {
                vscode.window.showErrorMessage('Failed to connect to Zotero database');
                return;
            }
        }
    }

    /**
     * Get items from Zotero database
     */
    public async getItems(): Promise<any[]> {
        if (!this.db || !this.bbt) {
            vscode.window.showErrorMessage('Database not connected');
            return [];
        }

        try {
            // Execute queries
            const [sqlBbt, sqlItems] = [
                this.bbt.exec(queryBbt),
                this.db.exec(queryItems)
            ];

            // Process results
            const items: any[] = [];
            
            // Get BBT data indexed by zoteroKey
            const bbtData: Record<string, string> = {};
            if (sqlBbt.length > 0) {
                const { columns, values } = sqlBbt[0];
                const zoteroKeyIndex = columns.indexOf('zoteroKey');
                const citeKeyIndex = columns.indexOf('citeKey');
                
                for (const row of values) {
                    const zoteroKey = row[zoteroKeyIndex] as string;
                    const citeKey = row[citeKeyIndex] as string;
                    bbtData[zoteroKey] = citeKey;
                }
            }
            
            // Process Zotero items and combine with BBT data
            if (sqlItems.length > 0) {
                const { columns, values } = sqlItems[0];
                const zoteroKeyIndex = columns.indexOf('zoteroKey');
                const libraryIdIndex = columns.indexOf('libraryID');
                const firstNameIndex = columns.indexOf('firstName');
                const lastNameIndex = columns.indexOf('lastName');
                const titleIndex = columns.indexOf('title');
                const dateIndex = columns.indexOf('date');
                const multiAuthorIndex = columns.indexOf('multiAuthor');
                
                for (const row of values) {
                    const zoteroKey = row[zoteroKeyIndex] as string;
                    const citeKey = bbtData[zoteroKey];
                    
                    if (citeKey) {
                        const item = {
                            zoteroKey: zoteroKey,
                            citeKey: citeKey,
                            libraryID: row[libraryIdIndex],
                            firstName: row[firstNameIndex],
                            lastName: row[lastNameIndex],
                            title: row[titleIndex],
                            year: extractYear(row[dateIndex] as string || ''),
                            multiAuthor: row[multiAuthorIndex] as number > 0
                        };
                        
                        items.push(item);
                    }
                }
            }

            return items;
        } catch (error) {
            handleError(error, `Error querying database`);
            return [];
        }
    }

    public getOpenOptions(citeKey: string): Array<any> {

        if (!this.db || !this.bbt) {
            vscode.window.showErrorMessage('Database not connected');
            return [];
        }

        const sqlZoteroKey = this.bbt.exec(queryZoteroKey(citeKey));
        const zoteroKey = this.getFirstValue(sqlZoteroKey, 'zoteroKey');

        if (!zoteroKey) {
            vscode.window.showErrorMessage(`Could not find Zotero key for ${citeKey}`);
            return [];
        }

        const options = [];
        options.push({ type: 'zotero', key: zoteroKey });

        const sqlPdf = this.db.exec(queryPdfByZoteroKey(zoteroKey));
        const pdfKey = this.getFirstValue(sqlPdf, 'pdfKey');

        if (pdfKey) {
            options.push({ type: 'pdf', key: pdfKey });
        }
        const sqlDoi = this.db.exec(queryDoiByZoteroKey(zoteroKey));
        const doi = this.getFirstValue(sqlDoi, 'value');

        if (doi) {
            options.push({ type: 'doi', key: doi });
        }

        return options;
    }

    public close(): void {
        if (this.db) {
            this.db.close();
            this.db = null;
        }

        if (this.bbt) {
            this.bbt.close();
            this.bbt = null;
        }
    }

    /**
     * Get the first value from a SQL result set.
     * @param sqlResult The SQL result set.
     * @param columnName The name of the column to retrieve the value from.
     * @returns The first value in the specified column, or null if not found.
     */
    private getFirstValue(sqlResult: initSqlJs.QueryExecResult[], columnName: string): any | null {
        if (sqlResult.length === 0) {
            return null;
        }
        const { columns, values } = sqlResult[0];
        const columnIndex = columns.indexOf(columnName);

        if (columnIndex === -1 || values.length === 0) {
            return null;
        }
        return values[0][columnIndex];
    }
}