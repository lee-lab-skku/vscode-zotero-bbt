import * as fs from 'fs/promises';
import * as vscode from 'vscode';
import initSqlJs, { Database } from 'sql.js';
import { queryBbt, queryItems, queryCreators} from './queries';
import { handleError, extractYear } from './helpers';

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
                const pdfKeyIndex = columns.indexOf('pdfKey');
                const groupIdIndex = columns.indexOf('groupID');
                const groupNameIndex = columns.indexOf('groupName');
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

                    if (row[pdfKeyIndex]) {
                        rawItems[zoteroKey].pdfKey = row[pdfKeyIndex];
                    }

                    if (row[fieldNameIndex] === 'DOI') {
                        rawItems[zoteroKey].DOI = row[valueIndex];
                    }

                    // Add group information
                    if (row[groupIdIndex]) {
                        rawItems[zoteroKey].groupID = row[groupIdIndex];
                        rawItems[zoteroKey].groupName = row[groupNameIndex];
                    }
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
}