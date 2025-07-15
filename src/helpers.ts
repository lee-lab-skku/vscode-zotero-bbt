// helper functions
import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';

export function expandPath(filePath: string): string {
    if (filePath.startsWith('~')) {
        return path.join(os.homedir(), filePath.slice(1));
    }
    if (!path.isAbsolute(filePath)) {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders) {
            const workspaceFolder = workspaceFolders[0].uri.fsPath;
            return path.join(workspaceFolder, filePath);
        }
    }
    return filePath;
}

export function formatAuthors(creators: any[]): string {
    switch (creators.length) {
        case 0:
            return 'NA';
        case 1:
            return `${creators[0].lastName}`;
        case 2:
            return `${creators[0].lastName} & ${creators[1].lastName}`;
        default:
            return `${creators[0].lastName} et al.`;
    }
}

export function extractYear(date: string): string {
    const match = date.match(/(\d{4})/);
    return match ? match[1] : 'NA';
}

export function formatCitation(citekey: string, fileType: string): string {
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

export function formatTypes(itemType: string): string {
    switch (itemType) {
        case 'book':
            return '📘';
        case 'bookSection':
            return '📖';
        case 'journalArticle':
            return '📄';
        case 'thesis':
            return '🎓';
        case 'preprint':
            return '📝';
        case 'webpage':
            return '🌏';
        default:
            return '📎';
    }
}

export function handleError(error: any, message: string): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`${message}: ${errorMessage}`);
}