import * as fs from 'fs';
import * as vscode from 'vscode';
import * as sqlite3 from '@vscode/sqlite3';
import { queryBbt, queryItems, queryCreators} from './queries';
import { handleError, extractYear } from './helpers';

interface DatabaseOptions {
    zoteroDbPath: string;
    betterBibtexDbPath: string;
}

export class ZoteroDatabase {
    private options: DatabaseOptions;
    private db: sqlite3.Database | null = null;
    private bbt: sqlite3.Database | null = null;

    constructor(options: DatabaseOptions) {
        this.options = options;
    }

    /**
     * Connect to Zotero and Better BibTeX databases
     */
    public connect(): boolean {
        try {
            // Check if files exist
            if (!fs.existsSync(this.options.zoteroDbPath)) {
                vscode.window.showErrorMessage(`Zotero database not found at ${this.options.zoteroDbPath}`);
                return false;
            }

            if (!fs.existsSync(this.options.betterBibtexDbPath)) {
                vscode.window.showErrorMessage(`Better BibTeX database not found at ${this.options.betterBibtexDbPath}`);
                return false;
            }

            // Connect to databases in read-only mode
            this.db = new sqlite3.Database(
                `file://${this.options.zoteroDbPath}?immutable=1`,
                sqlite3.OPEN_READONLY | sqlite3.OPEN_URI
            );
            this.bbt = new sqlite3.Database(
                `file://${this.options.betterBibtexDbPath}?immutable=1`,
                sqlite3.OPEN_READONLY | sqlite3.OPEN_URI
            );

            return true;
        } catch (error) {
            handleError(error, `Failed to connect to databases`);
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
            // Create promise-based versions of the database methods
            const dbAll = (sql: string): Promise<any[]> => {
                return new Promise((resolve, reject) => {
                    this.db!.all(sql, (err, rows) => {
                        if (err) { reject(err); }
                        else { resolve(rows); }
                    });
                });
            };

            const bbtAll = (sql: string): Promise<any[]> => {
                return new Promise((resolve, reject) => {
                    this.bbt!.all(sql, (err, rows) => {
                        if (err) { reject(err); }
                        else { resolve(rows); }
                    });
                });
            };


            // Execute queries
            const [sqlBbt, sqlItems, sqlCreators] = await Promise.all([
                bbtAll(queryBbt),
                dbAll(queryItems),
                dbAll(queryCreators)
            ]);

            // Process results
            const bbtCitekeys: Record<string, string> = {};
            for (const row of sqlBbt) {
                bbtCitekeys[row.itemKey] = row.citationKey;
            }

            const rawItems: Record<string, any> = {};
            for (const row of sqlItems) {
                if (!rawItems[row.key]) {
                    rawItems[row.key] = {
                        creators: [],
                        key: row.key
                    };
                }

                rawItems[row.key][row.fieldName] = row.value;
                rawItems[row.key].itemType = row.typeName;
                
                if (row.pdf_key) {
                    rawItems[row.key].pdfKey = row.pdf_key;
                }

                if (row.fieldName === 'DOI') {
                    rawItems[row.key].DOI = row.value;
                }
            }

            for (const row of sqlCreators) {
                if (rawItems[row.key]) {
                    rawItems[row.key].creators[row.orderIndex] = {
                        firstName: row.firstName,
                        lastName: row.lastName,
                        creatorType: row.creatorType
                    };
                }
            }

            // Build final items array with citekeys
            const items: any[] = [];
            for (const [key, item] of Object.entries(rawItems)) {
                const citekey = bbtCitekeys[key];
                if (citekey) {
                    item.citekey = citekey;
                    item.year = extractYear(item.date || item.year || 'n.d.');
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