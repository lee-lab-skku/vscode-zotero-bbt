import * as vscode from 'vscode';
import { ZoteroDatabase } from './zotero';
import { BibManager } from './bib';
import {
    expandPath,
    handleError
} from './helpers';

export function activate(context: vscode.ExtensionContext) {

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
                const authors = (`${item.firstName} ${item.lastName}`) || 'NA';

                return {
                    label: `${authors} (${item.year || 'n.d.'})`,
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
                let formattedCitation = `\\autocite{${citeKey}}`;

                // Insert citation
                editor.edit(editBuilder => {
                    editBuilder.insert(editor.selection.active, formattedCitation);
                });

                const bibManager = new BibManager();
                const bibFile = await bibManager.locateBibFile();
                if (bibFile) {
                    bibManager.updateBibFile(bibFile, selected.item);
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

            const bibManager = new BibManager();
            const bibFile = await bibManager.locateBibFile();
            
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