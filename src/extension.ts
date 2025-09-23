import * as vscode from 'vscode';
import { ZoteroDatabase } from './zotero';
import { BibManager } from './bib';
import {
    expandPath,
    formatAuthors,
    formatCitation,
    formatTypes,
    handleError
} from './helpers';

export function activate(context: vscode.ExtensionContext) {

    // initialize managers
    const bibManager = new BibManager();

    const searchLibrary = vscode.commands.registerCommand('zotero.searchLibrary', async () => {
        // initialize configuration
        let config = vscode.workspace.getConfiguration('zotero');
        let zoteroDbPath = config.get<string>('zoteroDbPath', '~/Zotero/zotero.sqlite');
        let betterBibtexDbPath = config.get<string>('betterBibtexDbPath', '~/Zotero/better-bibtex.sqlite');

        let zoteroDb = new ZoteroDatabase({
            zoteroDbPath: expandPath(zoteroDbPath),
            betterBibtexDbPath: expandPath(betterBibtexDbPath),
        });
        try {
            // Connect to database
            const connected = await zoteroDb.connect();
            if (!connected) {
                vscode.window.showErrorMessage('Failed to connect to Zotero database');
                return;
            }

            // Get items from Zotero
            const items = await zoteroDb.getItems();

            if (items.length === 0) {
                vscode.window.showInformationMessage('No items found in Zotero library');
                return;
            }

            // Create QuickPick items
            const quickPickItems = items.map(item => {
                const creators = item.creators;
                const authors = formatAuthors(creators);

                // determine icon based on item type
                const icon = formatTypes(item.itemType);

                return {
                    label: `${icon} ${authors} (${item.year || 'n.d.'})`,
                    description: `@${item.citeKey}`,
                    item: item,
                    detail: item.title
                };
            });

            // Show QuickPick
            let selected = await vscode.window.showQuickPick(quickPickItems, {
                placeHolder: 'Search Zotero library',
                matchOnDescription: true,
                matchOnDetail: true
            });

            if (selected) {
                // Get current file type
                const editor = vscode.window.activeTextEditor;
                if (!editor) {
                    vscode.window.showErrorMessage('No active editor');
                    return;
                }

                const fileType = editor.document.languageId;

                // Format citation key based on file type
                const citeKey = selected.item.citeKey;
                let formattedCitation = formatCitation(citeKey, fileType);

                // Insert citation
                editor.edit(editBuilder => {
                    editBuilder.insert(editor.selection.active, formattedCitation);
                });

                // Try to fetch BibLaTeX from web, fallback to local SQLite
                try {
                    const biblatexUrl = zoteroDb.generateBibLatexUrl(selected.item);
                    const biblatexContent = await zoteroDb.fetchBibLatexFile(biblatexUrl);
                    
                    // Extract the specific entry for this citation key
                    const bibEntry = zoteroDb.extractBibEntryByCiteKey(biblatexContent, citeKey);
                    
                    if (bibEntry) {
                        // Update bibliography file with the extracted entry
                        const bibFile = await bibManager.locateBibFile(fileType);
                        if (bibFile) {
                            // Ensure the entry ends with a newline for proper formatting
                            const formattedEntry = bibEntry.endsWith('\n') ? bibEntry : bibEntry + '\n';
                            bibManager.updateBibFile(bibFile, citeKey, formattedEntry, false); // Don't show message here
                            vscode.window.showInformationMessage(`Added @${citeKey} from web source to ${bibFile}`);
                        }
                    } else {
                        // Entry not found in web file, fallback to local
                        throw new Error(`Citation key '${citeKey}' not found in fetched BibLaTeX file`);
                    }
                    
                } catch (error) {
                    // Fallback to original workflow
                    vscode.window.showWarningMessage(`Web fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}. Using local database.`);
                    
                    const bibFile = await bibManager.locateBibFile(fileType);
                    if (bibFile) {
                        const bibEntry = bibManager.entryToBibEntry(selected.item);
                        bibManager.updateBibFile(bibFile, citeKey, bibEntry);
                    }
                }
            }
        } catch (error) {
            handleError(error, `Error occurred while searching Zotero library`);
        } finally {
            zoteroDb.close();
        }
    });
    context.subscriptions.push(searchLibrary);

    const openItem = vscode.commands.registerCommand('zotero.openItem', async () => {
        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor');
                return;
            }

            // Get the current position and word under cursor
            const position = editor.selection.active;
            const document = editor.document;
            const wordRange = document.getWordRangeAtPosition(position);
            const fileType = editor.document.languageId;

            if (!wordRange) {
                vscode.window.showInformationMessage('No word found at cursor position');
                return;
            }

            const word = document.getText(wordRange);

            let citeKey = word;
            // extract citation key (remove the @ symbol)
            if (citeKey.startsWith('@')) {
                citeKey = citeKey.substring(1);
            }
            const bibFile = await bibManager.locateBibFile(fileType);
            if (bibFile) {
                const openOptions = bibManager.getOpenOptions(bibFile, citeKey);
                if (openOptions.length === 0) {
                    vscode.window.showInformationMessage(`No PDF or DOI found for this item`);
                    return;
                }
                if (openOptions.length === 1) {
                    openAttachment(openOptions[0]);
                } else {
                    // Show QuickPick for multiple options
                    const quickPickItems = openOptions.map((option, index) => ({
                        label: option.type === 'pdf' ? 'Open PDF' : 
                               option.type === 'doi' ? 'Open DOI link' : 
                               option.type === 'zotero' ? 'Open in Zotero' : '',
                        option: option,
                        index: index
                    }));
                    
                    const selectedItem = await vscode.window.showQuickPick(quickPickItems, {
                        placeHolder: 'Choose action'
                    });

                    if (selectedItem) {
                        openAttachment(selectedItem.option);
                    }
                }
            }
        } catch (error) {
            handleError(error, `Error occurred while opening Zotero item`);
        }
    });
    context.subscriptions.push(openItem);
}

function openAttachment(option: any): void {
    switch (option.type) {
        case 'doi':
            vscode.env.openExternal(vscode.Uri.parse(option.url));
            break;
        case 'zotero':
            vscode.env.openExternal(vscode.Uri.parse(`zotero://select/library/items/${option.key}`));
            break;
        case 'pdf':
            vscode.env.openExternal(vscode.Uri.parse(`zotero://open-pdf/library/items/${option.key}`));
            break;
        default:
            break;
    }
}

export function deactivate() { }