import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import {
    expandPath,
    handleError,
    extractDate
} from './helpers';

export class BibManager {
    // Converts a Zotero item to a BibTeX entry
    public entryToBibEntry(item: any): string {
        let bibEntry = '@';
        const citeKey = item.citeKey || '';
        
        if (item.itemType === 'magazineArticle') {
            item.subtype = 'magazine';
        }
        if (item.itemType === 'newspaperArticle') {
            item.subtype = 'newspaper';
        }
        item.itemType = toBibtexType(item.itemType || 'misc');

        bibEntry += `${item.itemType}{${citeKey},\n`;
        
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
                item.itemType === 'article' &&
                key === 'publicationTitle'
            ) {
                bibEntry += `  journal = {${value}},\n`;
            } else if (
                item.itemType === 'inproceedings' &&
                key === 'proceedingsTitle'
            ) {
                bibEntry += `  booktitle = {${value}},\n`;
            } else if (
                key === 'date' &&
                typeof value === 'string'
            ) {
                // only add date if it is in YYYY-MM-DD format
                const date = extractDate(value);
                if (date) {
                    bibEntry += `  date = {${date}},\n`;
                }
            } else if (
                key === 'accessDate' &&
                typeof value === 'string'
            ) {
                // check if value has YYYY-MM-DD format if so, add match as urldate
                const urlDate = extractDate(value);
                if (urlDate) {
                    bibEntry += `  urldate = {${urlDate}},\n`;
                } 
            } else if (
                key !== 'citeKey' &&
                key !== 'itemType' &&
                key !== 'attachment' &&
                key !== 'abstractNote' &&
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

    public updateBibFile(bibFile: string, citeKey: string, bibEntry: string): void {
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
                vscode.window.showInformationMessage(`Created new bibliography file at ${bibFile}`);
            }

            // Read file to check if entry already exists
            const bibContent = fs.readFileSync(bibPath, 'utf8');
            const lines = bibContent.split('\n');

            // Check if entry already exists
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].match(new RegExp(`^@.*{${citeKey},`))) {
                    vscode.window.showInformationMessage(`Entry for @${citeKey} already exists in bibliography`);
                    return;
                }
            }

            // Append entry to file
            fs.appendFileSync(bibPath, bibEntry);
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
}

function toBibtexType(itemType: string): string {
    switch (itemType) {
        case 'journalArticle':
        case 'magazineArticle':
        case 'newspaperArticle':
        case 'preprint':
            return 'article';
        case 'artwork':
            return 'artwork';
        case 'audioRecording':
        case 'radioBroadcast':
        case 'podcast':
            return 'audio';
        case 'book':
            return 'book';
        case 'dataset':
            return 'dataset';
        case 'bookSection':
            return 'incollection';
        case 'conferencePaper':
            return 'inproceedings';
        case 'dictionaryEntry':
        case 'encyclopediaArticle':
            return 'inreference';
        case 'case':
        case 'gazette':
        case 'hearing':
            return 'jurisdiction';
        case 'bill':
        case 'statute':
            return 'legislation';
        case 'email':
        case 'letter':
            return 'letter';
        case 'document':
        case 'instantMessage':
        case 'interview':
        case 'map':
            return 'misc';
        case 'blogPost':
        case 'forumPost':
        case 'webpage':
            return 'online';
        case 'patent':
            return 'patent';
        case 'report':
            return 'report';
        case 'computerProgram':
            return 'software';
        case 'standard':
            return 'standard';
        case 'thesis':
            return 'thesis';
        case 'manuscript':
        case 'presentation':
            return 'unpublished';
        case 'film':
        case 'tvBroadcast':
        case 'videoRecording':
            return 'video';
        default:
            return itemType;
    }
}