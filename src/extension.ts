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
        const zoteroDb = initZoteroDb();

        try {
            // Connect to database
            await zoteroDb.connectIfNeeded();

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

                const bibFile = await bibManager.locateBibFile(fileType);
                if (bibFile) {
                    // Try to fetch BibLaTeX from web, fallback to local SQLite
                    try {
                        // const bibEntry = await bibManager.bbtExport(selected.item, 'Better BibTex');
                        const bibEntry = await bibManager.bbtExport(selected.item, 'Better BibLaTex');
                        bibManager.updateBibFile(bibFile, citeKey, bibEntry);

                    } catch (error) {
                        // Fallback to original workflow
                        vscode.window.showWarningMessage(`Web fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}. Using local database.`);

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
        // initialize configuration
        const zoteroDb = initZoteroDb();
        
        try {
            // Connect to database
            await zoteroDb.connectIfNeeded();

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
                const openOptions = zoteroDb.getOpenOptions(citeKey);
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
        } finally {
            zoteroDb.close();
        }
    });
    context.subscriptions.push(openItem);
}

function openAttachment(option: any): void {
    switch (option.type) {
        case 'doi':
            vscode.env.openExternal(vscode.Uri.parse(`https://doi.org/${option.key}`));
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

function initZoteroDb(): ZoteroDatabase {
        const config = vscode.workspace.getConfiguration('zotero');
        const zoteroDbPath = config.get<string>('zoteroDbPath', '~/Zotero/zotero.sqlite');
        const betterBibtexDbPath = config.get<string>('betterBibtexDbPath', '~/Zotero/better-bibtex.sqlite');

        return new ZoteroDatabase({
            zoteroDbPath: expandPath(zoteroDbPath),
            betterBibtexDbPath: expandPath(betterBibtexDbPath),
        });
}


export function deactivate() { }