// helper functions
import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';

export function expandPath(filePath: string): string {
    if (filePath.startsWith('~/')) {
        return path.join(os.homedir(), filePath.slice(2));
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

export function extractYear(date: string | null): string {
    const match = date?.match(/(\d{4})/);
    return match ? match[1] : '';
}

export function handleError(error: any, message: string): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`${message}: ${errorMessage}`);
}

// Validate if content is a proper Bib(La)Tex Entry
export function isValidBibEntry(content: string): boolean {
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