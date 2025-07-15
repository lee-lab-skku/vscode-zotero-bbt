import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { expandPath, handleError } from './helpers';

export class BibManager {
    // Converts a Zotero item to a BibTeX entry
    public entryToBibEntry(item: any): string {
        let bibEntry = '@';
        const citekey = item.citekey || '';

        bibEntry += `${item.itemType || ''}{${citekey},\n`;

        for (const [key, value] of Object.entries(item)) {
            if (key === 'creators') {
                bibEntry += '  author = {';
                let author = '';

                for (const creator of value as any[]) {
                    author += `${creator.lastName || ''}, ${creator.firstName || ''} and `;
                }

                // Remove trailing ' and '
                author = author.slice(0, -5);
                bibEntry += `${author}},\n`;
            } else if (
                key !== 'citekey' &&
                key !== 'itemType' &&
                key !== 'attachment' &&
                typeof value === 'string'
            ) {
                bibEntry += `  ${key} = {${value}},\n`;
            }
        }

        bibEntry += '}\n';
        return bibEntry;
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
        return null;
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
                bibPath = null;
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

    public updateBibFile(bibFile: string, citekey: string, bibEntry: string): void {
        try {
            const bibPath = expandPath(bibFile);

            // Check if file exists
            if (!fs.existsSync(bibPath)) {
                // Create directory if it doesn't exist
                const bibDir = path.dirname(bibPath);
                if (!fs.existsSync(bibDir)) {
                    fs.mkdirSync(bibDir, { recursive: true });
                }
                // Create empty file
                fs.writeFileSync(bibPath, '');
                vscode.window.showInformationMessage(`Entry for ${citekey} already exists in bibliography`);
            }

            // Read file to check if entry already exists
            const bibContent = fs.readFileSync(bibPath, 'utf8');
            const lines = bibContent.split('\n');

            // Check if entry already exists
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].match(new RegExp(`^@.*{${citekey},`))) {
                    vscode.window.showInformationMessage(`Entry for ${citekey} already exists in bibliography`);
                    return;
                }
            }

            // Append entry to file
            fs.appendFileSync(bibPath, bibEntry);
            vscode.window.showInformationMessage(`Added ${citekey} to ${bibPath}`);
        } catch (error) {
            handleError(error, `Failed to update bibliography file`);
        }
    }
}
