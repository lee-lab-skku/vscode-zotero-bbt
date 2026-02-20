import * as vscode from 'vscode';
import * as path from 'path';
import {
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
    private editor: vscode.TextEditor;
    private fileType: string;
    private serverUrl: string;

    constructor(editor: vscode.TextEditor, fileType: string) {
        const config = vscode.workspace.getConfiguration('zotero');
        const translator = config.get<string>('betterBibtexTranslator', 'Better BibLaTeX');
        this.translator = translator;
        this.editor = editor;
        this.fileType = fileType;
        this.serverUrl = 'http://localhost:23119';
    }

    private resolveBibUri(bibFile: string): vscode.Uri {
        // if bibFile is an absolute path, return it as is
        if (path.isAbsolute(bibFile)) {
            return vscode.Uri.file(bibFile);
        }
        // otherwise, resolve it relative to the current document
        const docDir = path.dirname(this.editor.document.uri.fsPath);
        return vscode.Uri.file(path.join(docDir, bibFile));
    }

    private async fileExists(uri: vscode.Uri): Promise<boolean> {
        try {
            await vscode.workspace.fs.stat(uri);
            return true;
        } catch {
            return false;
        }
    }

    private async readFileAsString(uri: vscode.Uri): Promise<string> {
        const data = await vscode.workspace.fs.readFile(uri);
        return new TextDecoder('utf-8').decode(data);
    }

    private async writeFileFromString(uri: vscode.Uri, content: string): Promise<void> {
        const data = new TextEncoder().encode(content);
        await vscode.workspace.fs.writeFile(uri, data);
    }

    public async bbtExport(
        item: any
    ): Promise<string> {
        const url = `${this.serverUrl}/better-bibtex/json-rpc`;

        const payload = {
            jsonrpc: '2.0',
            method: 'item.export',
            params: {
                citekeys: [item.citeKey],
                translator: this.translator,
                libraryID: item.libraryID
            }
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

            // Handle JSON-RPC errors
            if (json.error) {
                if (json.error.code === -32603) {
                    vscode.window.showErrorMessage(`Cannot connect to Better BibTeX. Make sure Zotero window is open!`);
                    return '';
                }
                vscode.window.showErrorMessage(`Better BibTeX error: ${json.error.message || 'Unknown error'}`);
                return '';
            }

            // Ensure result is a string
            if (typeof json.result !== 'string') {
                vscode.window.showErrorMessage('Better BibTeX returned invalid result format');
                return '';
            }

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
            const quartoYmlUri = vscode.Uri.joinPath(workspaceFolders[0].uri, '_quarto.yml');
            if (await this.fileExists(quartoYmlUri)) {
                const quartoYml = await this.readFileAsString(quartoYmlUri);
                const quartoMatch = quartoYml.match(/['"]?([^'"\s]+\.bib)['"]?/);
                if (quartoMatch) {
                    return quartoMatch[0];
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
        const rootUri = workspaceFolders[0].uri;
        const candidates = ['bibliography.bib', 'references.bib'];
        for (const candidate of candidates) {
            const candidateUri = vscode.Uri.joinPath(rootUri, candidate);
            if (await this.fileExists(candidateUri)) {
                return candidate;
            }
        }
        const entries = await vscode.workspace.fs.readDirectory(rootUri);
        for (const [name, type] of entries) {
            if (name.endsWith('.bib') && type === vscode.FileType.File) {
                return name;
            }
        }
        return null;
    }

    public async locateBibFile(): Promise<string | null> {
        const document = this.editor.document;
        const text = document.getText();

        let bibPath: string | null = null;

        switch (this.fileType) {
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
                prompt: 'Bibliography file not found. Please enter path to bibliography file (default: references.bib)',
                placeHolder: 'Path to .bib file',
                value: 'references.bib'
            }) || null;
        }

        return bibPath;
    }

    public async updateBibFile(item: any): Promise<void> {
        const bibFile = await this.locateBibFile();
        if (!bibFile) {
            vscode.window.showErrorMessage('Error locating *.bib file');
            return;
        }

        try {
            const bibUri = this.resolveBibUri(bibFile);
            const citeKey = item.citeKey;

            // Check if file exists
            if (!await this.fileExists(bibUri)) {
                // Create directory if it doesn't exist (createDirectory is recursive)
                const dirUri = bibUri.with({ path: path.posix.dirname(bibUri.path) });
                await vscode.workspace.fs.createDirectory(dirUri);
                // Create empty file
                await this.writeFileFromString(bibUri, '');
                vscode.window.showInformationMessage(`Created new bibliography file at ${bibFile}`);
            }

            // Read file to check if entry already exists
            const bibContent = await this.readFileAsString(bibUri);
            const lines = bibContent.split('\n');

            // Check if entry already exists
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].match(new RegExp(`^@.*{${citeKey},`))) {
                    vscode.window.showInformationMessage(`Entry for @${citeKey} already exists in bibliography`);
                    this.insertCite(item);
                    return;
                }
            }

            // Get BibTeX entry
            const bibEntry = await this.bbtExport(item);
            // if bibEntry is empty or undefined, return (probably could not connect to BBT server)
            if (!bibEntry || bibEntry.trim() === '') {
                return;
            }

            // check if bibEntry is valid
            if (!isValidBibEntry(bibEntry)) {
                vscode.window.showErrorMessage('Invalid BibLaTeX entry. Not updating bibliography file.');
                return;
            }

            this.insertCite(item);

            // Add empty line before new entry if file is not empty
            const needsEmptyLine = bibContent.trim().length > 0 && !bibContent.trim().endsWith('\n');
            const newContent = bibContent + (needsEmptyLine ? '\n' : '') + bibEntry;

            // Write updated content
            await this.writeFileFromString(bibUri, newContent);
            vscode.window.showInformationMessage(`Added @${citeKey} to ${bibFile}`);
        } catch (error) {
            handleError(error, `Failed to update bibliography file`);
        }
    }

    public async getOpenOptions(bibFile: string, citeKey: string): Promise<Array<any>> {
        const bibUri = this.resolveBibUri(bibFile);
        if (!await this.fileExists(bibUri)) {
            vscode.window.showErrorMessage(`Bibliography file not found at ${bibUri.toString()}`);
            return [];
        }

        const bibContent = await this.readFileAsString(bibUri);
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

    private insertCite(item: any) {
        // Format citation key based on file type
        const citeKey = item.citeKey;
        let formattedCitation = formatCitation(citeKey, this.fileType);

        // Insert citation
        this.editor.edit(editBuilder => {
            editBuilder.insert(this.editor.selection.active, formattedCitation);
        });
    }
}
