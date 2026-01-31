import * as fs from 'fs/promises';
import * as vscode from 'vscode';
import initSqlJs, { Database } from 'sql.js';
import {
    queryBbt,
    queryItems,
    queryCreators,
    queryZoteroKey,
    queryPdfByZoteroKey,
    queryDoiByZoteroKey,
    queryGroupIDByLibraryID,
    queryGroupItemsByZoterokey
} from './queries';
import {
    handleError,
    extractYear,
    formatTypes
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
            const [sqlBbt, sqlItems, sqlCreators] = [
                this.bbt.exec(queryBbt),
                this.db.exec(queryItems),
                this.db.exec(queryCreators)
            ];

            // Process results
            const bbtCitekeys: Record<string, string> = {};
            if (sqlBbt.length > 0) {
                const { columns, values } = sqlBbt[0];
                const zoteroKeyIndex = columns.indexOf('zoteroKey');
                const citeKeyIndex = columns.indexOf('citeKey');
                for (const row of values) {
                    bbtCitekeys[row[zoteroKeyIndex] as string] = row[citeKeyIndex] as string;
                }
            }

            const rawItems: Record<string, any> = {};
            if (sqlItems.length > 0) {
                const { columns, values } = sqlItems[0];
                const zoteroKeyIndex = columns.indexOf('zoteroKey');
                const fieldNameIndex = columns.indexOf('fieldName');
                const valueIndex = columns.indexOf('value');
                const typeNameIndex = columns.indexOf('typeName');
                const libraryIdIndex = columns.indexOf('libraryID');

                for (const row of values) {
                    const zoteroKey = row[zoteroKeyIndex] as string;
                    if (!rawItems[zoteroKey]) {
                        rawItems[zoteroKey] = {
                            creators: [],
                            zoteroKey: zoteroKey
                        };
                    }

                    rawItems[zoteroKey][row[fieldNameIndex] as string] = row[valueIndex];
                    rawItems[zoteroKey].itemType = row[typeNameIndex];
                    rawItems[zoteroKey].libraryID = row[libraryIdIndex];
                }
            }

            if (sqlCreators.length > 0) {
                const { columns, values } = sqlCreators[0];
                const zoteroKeyIndex = columns.indexOf('zoteroKey');
                const orderIndexIndex = columns.indexOf('orderIndex');
                const firstNameIndex = columns.indexOf('firstName');
                const lastNameIndex = columns.indexOf('lastName');
                const creatorTypeIndex = columns.indexOf('creatorType');

                for (const row of values) {
                    const zoteroKey = row[zoteroKeyIndex] as string;
                    if (rawItems[zoteroKey]) {
                        rawItems[zoteroKey].creators[row[orderIndexIndex] as number] = {
                            firstName: row[firstNameIndex],
                            lastName: row[lastNameIndex],
                            creatorType: row[creatorTypeIndex]
                        };
                    }
                }
            }

            // Build final items array with citeKeys
            const items: any[] = [];
            for (const [zoteroKey, item] of Object.entries(rawItems)) {
                const citeKey = bbtCitekeys[zoteroKey];
                if (citeKey) {
                    item.citeKey = citeKey;
                    item.year = extractYear(item.date || '');
                    items.push(item);
                }
            }

            return items;
        } catch (error) {
            handleError(error, `Error querying database`);
            return [];
        }
    }

    public async getOpenOptions(citeKey: string): Promise<any[] | null> {

        if (!this.db || !this.bbt) {
            vscode.window.showErrorMessage('Database not connected');
            return null;
        }

        const sqlZoteroKey = this.bbt.exec(queryZoteroKey(citeKey));
        
        
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
        const pdfKey = this.getFirstValue(sqlPdf)['pdfKey'];

        if (pdfKey) {
            options.push({ type: 'pdf', key: pdfKey, groupID: groupID });
        }
        const sqlDoi = this.db.exec(queryDoiByZoteroKey(zoteroKey, libraryID));
        const doi = this.getFirstValue(sqlDoi)['value'];

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
    private getFirstValue(sqlResult: initSqlJs.QueryExecResult[]): any | null {
        if (sqlResult.length === 0) {
            return null;
        }
        return this.getValues(sqlResult)[0];
    }

    private getValues(sqlResult: initSqlJs.QueryExecResult[]): any[] {
        const { columns, values } = sqlResult[0];

        // return results as array of objects
        const results: any[] = [];
        for (const row of values) {
            const result: any = {};
            for (let i = 0; i < columns.length; i++) {
                result[columns[i]] = row[i];
            }
            results.push(result);
        }
        return results;
    }
}