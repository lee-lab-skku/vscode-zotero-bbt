import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import {
    expandPath,
    handleError,
    isValidBibEntry,
    formatCitation
} from './helpers';

export class BibManager {
    /**
     * Export better bibtex citation using JSON-RPC
     * @param item The Zotero item to export.
     * @param translator The Better BibTeX translator to use.
     * @returns The exported Bib(La)TeX entry.
     */

    private translator: string;
    private editor: vscode.TextEditor | undefined;

    constructor() {
        const config = vscode.workspace.getConfiguration('zotero');
        const translator = config.get<string>('betterBibtexTranslator', 'Better BibLaTeX');
        this.translator = translator;
    }

    public async bbtExport(
        item: any
    ): Promise<string> {
        const url = 'http://localhost:23119/better-bibtex/json-rpc';

        const payload = {
            jsonrpc: '2.0',
            method: 'item.export',
            params: {
                citekeys: [item.citeKey],
                translator: this.translator,
            },
            id: item.libraryID,
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body: JSON.stringify(payload),
            });
            const json = await response.json();
            return json.result;

        } catch (error) {
            vscode.window.showErrorMessage('Cannot connect to Better BibTeX. Make sure Zotero is running!');
            return '';
        }
    }

    private async locateBibMd(text: string): Promise<string | null> {
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
        return await this.locateWorkspaceBib();
    }

    private async locateBibTex(text: string): Promise<string | null> {
        // Look for \bibliography or \addbibresource
        const bibMatch = text.match(/\\bibliography\{['"]?([^'"{}]+)['"]?\}/);
        if (bibMatch) {
            return `${bibMatch[1]}.bib`;
        }

        const biblatexMatch = text.match(/\\addbibresource\{['"]?([^'"{}]+)['"]?\}/);
        if (biblatexMatch) {
            let bibFile = biblatexMatch[1];
            if (!bibFile.endsWith('.bib')) {
                bibFile += '.bib';
            }
            return bibFile;
        }
        return await this.locateWorkspaceBib();
    }

    private async locateWorkspaceBib(): Promise<string | null> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return null;
        }
        const rootPath = workspaceFolders[0].uri.fsPath;
        const candidates = ['bibliography.bib', 'references.bib'];
        for (const candidate of candidates) {
            const candidatePath = path.join(rootPath, candidate);
            if (fs.existsSync(candidatePath)) {
                return candidate;
            }
        }
        const files = fs.readdirSync(rootPath);
        for (const file of files) {
            if (file.endsWith('.bib')) {
                return file;
            }
        }
        return null;
    }

    public async locateBibFile(fileType: string): Promise<string | null> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) { return null; }

        const document = editor.document;
        const text = document.getText();

        let bibPath: string | null = null;

        switch (fileType) {
            case 'markdown':
            case 'quarto':
                bibPath = await this.locateBibMd(text);
                break;
            case 'latex':
            case 'tex':
            case 'plaintex':
                bibPath = await this.locateBibTex(text);
                break;
            default:
                bibPath = await this.locateWorkspaceBib();
        }

        // if no bibliography found, ask user
        if (!bibPath) {
            bibPath = await vscode.window.showInputBox({
                prompt: 'Bibliography file not found. Please enter path to bibliography file',
                placeHolder: 'Path to .bib file'
            }) || null;
        }

        return bibPath;
    }

    public async updateBibFile(item: any): Promise<void> {
        // Check if editor is open
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor');
            return;
        }
        // Get current file type
        const fileType = editor.document.languageId;

        const bibFile = await this.locateBibFile(fileType);
        if (!bibFile) {
            vscode.window.showErrorMessage('Error locating *.bib file');
            return;
        }

        try {
            const bibPath = expandPath(bibFile);
            const citeKey = item.citeKey;

            // Check if file exists
            if (!fs.existsSync(bibPath)) {
                // Create directory if it doesn't exist
                const bibDir = path.dirname(bibPath);
                if (!fs.existsSync(bibDir)) {
                    fs.mkdirSync(bibDir, { recursive: true });
                }
                // Create empty file
                fs.writeFileSync(bibPath, '');
                vscode.window.showInformationMessage(`Created new bibliography file at ${bibFile}`);
            }

            // Read file to check if entry already exists
            const bibContent = fs.readFileSync(bibPath, 'utf8');
            const lines = bibContent.split('\n');

            // Check if entry already exists
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].match(new RegExp(`^@.*{${citeKey},`))) {
                    vscode.window.showInformationMessage(`Entry for @${citeKey} already exists in bibliography`);
                    this.insertCite(item, editor, fileType);
                    return;
                }
            }

            // Get BibTeX entry

            const bibEntry = await this.bbtExport(item);
            // if bibEntry is empty, return (probably could not connect to BBT server)
            if (bibEntry.trim() === '') {
                return;
            }

            // check if bibEntry is valid
            if (!isValidBibEntry(bibEntry)) {
                vscode.window.showErrorMessage('Invalid BibLaTeX entry. Not updating bibliography file.');
                return;
            }

            this.insertCite(item, editor, fileType);

            // Add empty line before new entry if file is not empty
            const needsEmptyLine = bibContent.trim().length > 0 && !bibContent.trim().endsWith('\n');
            const entryToAdd = needsEmptyLine ? '\n' + bibEntry : bibEntry;

            // Append entry to file
            fs.appendFileSync(bibPath, entryToAdd);
            vscode.window.showInformationMessage(`Added @${citeKey} to ${bibFile}`);
        } catch (error) {
            handleError(error, `Failed to update bibliography file`);
        }
    }

    public getOpenOptions(bibFile: string, citeKey: string): Array<any> {
        const bibPath = expandPath(bibFile);
        if (!fs.existsSync(bibPath)) {
            vscode.window.showErrorMessage(`Bibliography file not found at ${bibPath}`);
            return [];
        }

        const bibContent = fs.readFileSync(bibPath, 'utf8');
        // Create regex to match the specific entry by cite key
        const entryRegex = new RegExp(`@\\w+\\{${citeKey},[^@]*?\\n\\}`, 'gs');

        // Find the specific entry
        const match = bibContent.match(entryRegex);

        if (!match || match.length === 0) {
            return [];
        }

        const options = [];
        const entryText = match[0];

        // Extract pdfKey
        const pdfKeyMatch = entryText.match(/pdfKey\s*=\s*\{([^}]+)\}/);
        if (pdfKeyMatch) {
            options.push({ type: 'pdf', key: pdfKeyMatch[1] });
        }
        // Extract Zotero Item Key
        const keyMatch = entryText.match(/zoteroKey\s*=\s*\{([^}]+)\}/);
        if (keyMatch) {
            options.push({ type: 'zotero', key: keyMatch[1] });
        }
        // Extract DOI
        const doiMatch = entryText.match(/DOI\s*=\s*\{([^}]+)\}/);
        if (doiMatch) {
            options.push({ type: 'doi', url: `https://doi.org/${doiMatch[1]}` });
        }

        return options;
    }

    private insertCite(item: any, editor: vscode.TextEditor, fileType: string) {
        // Format citation key based on file type
        const citeKey = item.citeKey;
        let formattedCitation = formatCitation(citeKey, fileType);

        // Insert citation
        editor.edit(editBuilder => {
            editBuilder.insert(editor.selection.active, formattedCitation);
        });
    }
}