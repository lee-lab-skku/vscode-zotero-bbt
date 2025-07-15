// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ZoteroDatabase } from './database';

// this method is called when the extension is activated
export function activate(context: vscode.ExtensionContext) {
    // initialize configuration
    const config = vscode.workspace.getConfiguration('zotero');
    const zoteroDbPath = config.get<string>('zoteroDbPath', '~/Zotero/zotero.sqlite');
    const betterBibtexDbPath = config.get<string>('betterBibtexDbPath', '~/Zotero/better-bibtex.sqlite');

    // initialize managers
    // const bibManager = new BibManager();
    const zoteroDb = new ZoteroDatabase({
        zoteroDbPath: expandPath(zoteroDbPath),
        betterBibtexDbPath: expandPath(betterBibtexDbPath),
    });

    console.log('vscode-zotero activated');

    const disposable = vscode.commands.registerCommand('zotero.searchLibrary', async () => {
        try {
            // Connect to database
            const connected = zoteroDb.connect();
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
                const creators = item.creators ;
                // If no creators, use 'NA' for author name
                let authors = 'NA';
                // single author
                if (creators.length === 1) {
                    authors = `${creators[0].lastName}`;
                } else if (creators.length === 2) {
                    authors = `${creators[0].lastName} & ${creators[1].lastName}`;
                }
                // multiple authors
                else if (creators.length > 2) {
                    authors = `${creators[0].lastName} et al.`;
                }
                const year = extractYear(item.year || item.date || 'n.d.');

                // determine icon based on item type
                // const attachmentOptions = getAttachmentOptions(item);
                let icon = '';

                return {
                    label: `${icon} ${authors}, (${year}) ${item.title}`,
                    description: item.citekey,
                    item: item
                };
            });

            // Show QuickPick
            const selected = await vscode.window.showQuickPick(quickPickItems, {
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

                const document = editor.document;
                const fileType = document.languageId;

                // Format citation key based on file type
                const citekey = selected.item.citekey;
                let formattedCitation = formatCitation(citekey, fileType);

                // Insert citation
                editor.edit(editBuilder => {
                    editBuilder.insert(editor.selection.active, formattedCitation);
                });

                // Update bibliography file
                // const bibPath = await locateBibFile(fileType);
                // if (bibPath) {
                //     const bibEntry = bibManager.entryToBibEntry(selected.item);
                //     updateBibFile(bibPath, citekey, bibEntry);
                // }
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Error: ${errorMessage}`);
        }
    });

    context.subscriptions.push(disposable);
}

// helper functions
function expandPath(filePath: string): string {
    if (filePath.startsWith('~')) {
        return path.join(os.homedir(), filePath.slice(1));
    }
    return filePath;
}

function extractYear(date: string): string {
    const match = date.match(/(\d{4})/);
    return match ? match[1] : 'NA';
}

function formatCitation(citekey: string, fileType: string): string {
    switch (fileType) {
        case 'latex':
        case 'tex':
        case 'plaintex':
            return `\\cite{${citekey}}`;
        case 'markdown':
        case 'quarto':
            return `@${citekey}`;
        default:
            return `@${citekey}`;
    }
}

async function locateBibFile(fileType: string): Promise<string | null> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { return null; }

    const document = editor.document;
    const text = document.getText();

    if (fileType === 'markdown' || fileType === 'quarto') {
        // Look for bibliography in YAML header
        const match = text.match(/bibliography:\s*['"]?(.+?)['"]?(\s|$)/);
        if (match) {
            return match[1];
        }

        // Check for _quarto.yml in project root
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders) {
            const quartoYmlPath = path.join(workspaceFolders[0].uri.fsPath, '_quarto.yml');
            if (fs.existsSync(quartoYmlPath)) {
                const quartoYml = fs.readFileSync(quartoYmlPath, 'utf8');
                const quartoMatch = quartoYml.match(/bibliography:\s*['"]?(.+?)['"]?(\s|$)/);
                if (quartoMatch) {
                    return quartoMatch[1];
                }
            }
        }
    } else if (fileType === 'latex' || fileType === 'tex' || fileType === 'plaintex') {
        // Look for \bibliography or \addbibresource
        const bibMatch = text.match(/\\bibliography\{['"]?([^'"{}]+)['"]?\}/);
        if (bibMatch) {
            return `${bibMatch[1]}.bib`;
        }

        const biblatexMatch = text.match(/\\addbibresource\{['"]?([^'"{}]+)['"]?\}/);
        if (biblatexMatch) {
            let bibPath = biblatexMatch[1];
            if (!bibPath.endsWith('.bib')) {
                bibPath += '.bib';
            }
            return bibPath;
        }
    }

    // If no bibliography found, ask user
    const bibPath = await vscode.window.showInputBox({
        prompt: 'Bibliography file not found. Please enter path to bibliography file',
        placeHolder: 'Path to .bib file'
    });

    return bibPath || null;
}

// This method is called when your extension is deactivated
export function deactivate() { }