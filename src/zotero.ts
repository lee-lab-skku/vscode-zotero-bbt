import * as fs from 'fs/promises';
import * as vscode from 'vscode';
import initSqlJs, { Database } from 'sql.js';
import { queryBbt, queryItems } from './queries';
import { extractYear, handleError } from './helpers';

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
                            year: extractYear(row[dateIndex] as string || '')
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
     * Fetch BibLaTeX file from Better BibTeX web endpoint
     */
    public async fetchBibLatexFile(url: string): Promise<string> {
        try {
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const content = await response.text();
            
            // Validate if it's a proper BibLaTeX file
            if (!this.isValidBibLatexContent(content)) {
                throw new Error('Retrieved content is not a valid BibLaTeX file');
            }
            
            return content;
        } catch (error) {
            if (error instanceof TypeError && error.message.includes('fetch')) {
                throw new Error('Cannot connect to Better BibTeX server at 127.0.0.1:23119. Make sure Zotero is running with Better BibTeX plugin');
            }
            throw error;
        }
    }

    /**
     * Validate if content is a proper BibLaTeX file
     */
    private isValidBibLatexContent(content: string): boolean {
        // Basic validation checks
        if (!content || content.trim().length === 0) {
            return false;
        }
        
        // Check for BibLaTeX entry patterns
        const bibEntryPattern = /@\w+\s*\{[^,]+,/;
        if (!bibEntryPattern.test(content)) {
            return false;
        }
        
        return true;
    }

    /**
     * Extract a specific BibLaTeX entry by citation key from the content
     */
    public extractBibEntryByCiteKey(biblatexContent: string, citeKey: string): string | null {
        try {
            // Create regex pattern to match the specific entry
            // Pattern: @entrytype{citekey, ... } (handles nested braces)
            const entryPattern = new RegExp(
                `@\\w+\\s*\\{\\s*${this.escapeRegex(citeKey)}\\s*,([^@]*)(?=@|$)`,
                'gis'
            );

            const match = entryPattern.exec(biblatexContent);
            if (!match) {
                return null;
            }

            // Extract the full entry including the opening part
            let fullEntry = match[0];
            
            // Balance braces to ensure we get the complete entry
            const entryStart = biblatexContent.indexOf(match[0]);
            let braceCount = 0;
            let pos = entryStart;
            let entryEnd = entryStart;

            for (let i = entryStart; i < biblatexContent.length; i++) {
                const char = biblatexContent[i];
                if (char === '{') {
                    braceCount++;
                } else if (char === '}') {
                    braceCount--;
                    if (braceCount === 0) {
                        entryEnd = i + 1;
                        break;
                    }
                }
            }

            if (braceCount === 0 && entryEnd > entryStart) {
                return biblatexContent.substring(entryStart, entryEnd).trim() + '\n';
            }

            return null;
        } catch (error) {
            handleError(error, `Error extracting BibLaTeX entry for ${citeKey}`);
            return null;
        }
    }

    /**
     * Escape special regex characters
     */
    private escapeRegex(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}