import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import { BibManager } from '../bib';

suite('BibManager', () => {
    /** Creates a BibManager backed by an untitled in-memory document. */
    async function makeManagerWithContent(content: string, fileType: string): Promise<BibManager> {
        const doc = await vscode.workspace.openTextDocument({ content, language: fileType });
        const editor = await vscode.window.showTextDocument(doc);
        return new BibManager(editor, fileType);
    }

    /** Creates a BibManager backed by an on-disk fixture file. */
    async function makeManagerFromFile(filename: string, fileType: string): Promise<BibManager> {
        const uri = joinFixturePath(filename);
        const doc = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(doc);
        return new BibManager(editor, fileType);
    }

    function joinFixturePath(filename: string): vscode.Uri {
        const fixtureDir = path.join(__dirname, '..', '..', 'src', 'test', 'resources.test');
        return vscode.Uri.file(path.join(fixtureDir, filename));
    }

    // -------------------------------------------------------------------------
    suite('locateBibFile — LaTeX', () => {
        teardown(async () => {
            await vscode.commands.executeCommand('workbench.action.closeAllEditors');
        });

        test('\\bibliography{refs} → refs.bib', async () => {
            const manager = await makeManagerWithContent('\\bibliography{refs}', 'latex');
            const result = await manager.locateBibFile();
            assert.strictEqual(result, 'refs.bib');
        });

        test('\\bibliography{path/to/refs} → path/to/refs.bib', async () => {
            const manager = await makeManagerWithContent('\\bibliography{path/to/refs}', 'latex');
            const result = await manager.locateBibFile();
            assert.strictEqual(result, 'path/to/refs.bib');
        });

        test('\\addbibresource{refs.bib} → refs.bib', async () => {
            const manager = await makeManagerWithContent('\\addbibresource{refs.bib}', 'latex');
            const result = await manager.locateBibFile();
            assert.strictEqual(result, 'refs.bib');
        });

        test('\\addbibresource{refs} → refs.bib (extension added)', async () => {
            const manager = await makeManagerWithContent('\\addbibresource{refs}', 'latex');
            const result = await manager.locateBibFile();
            assert.strictEqual(result, 'refs.bib');
        });
    });

    // -------------------------------------------------------------------------
    suite('locateBibFile — Markdown / Quarto', () => {
        teardown(async () => {
            await vscode.commands.executeCommand('workbench.action.closeAllEditors');
        });

        test('YAML bibliography field (quarto)', async () => {
            const content = '---\nbibliography: refs.bib\n---\n';
            const manager = await makeManagerWithContent(content, 'quarto');
            const result = await manager.locateBibFile();
            assert.strictEqual(result, 'refs.bib');
        });

        test("YAML bibliography with quoted value 'refs.bib'", async () => {
            const content = "---\nbibliography: 'refs.bib'\n---\n";
            const manager = await makeManagerWithContent(content, 'markdown');
            const result = await manager.locateBibFile();
            assert.strictEqual(result, 'refs.bib');
        });

        test('YAML bibliography as a list with multiple entries', async () => {
            const content = '---\nbibliography: [refs.bib, other.bib]\n---\n';
            const manager = await makeManagerWithContent(content, 'markdown');
            const result = await manager.locateBibFile();
            assert.strictEqual(result, 'refs.bib');
        });

        test('YAML bibliography as a list with multi-line list', async () => {
            const content = '---\nbibliography:\n- refs.bib\n- other.bib\n---\n';
            const manager = await makeManagerWithContent(content, 'markdown');
            const result = await manager.locateBibFile();
            assert.strictEqual(result, 'refs.bib');
        });
    });

    suite('BibManager - Other functions', () => {
        teardown(async () => {
            await vscode.commands.executeCommand('workbench.action.closeAllEditors');
        });

        test('resolveBibUri (Absolute)', async () => {
            const manager = await makeManagerWithContent('', 'latex');
            const absPath = '/home/user/refs.bib';
            const expectedPath = vscode.Uri.file(absPath).path;
            const result = (manager as any).resolveBibUri(absPath);

            assert.strictEqual(result.path, expectedPath);
        });

        test('resolveBibUri (Relative)', async () => {
            const manager = await makeManagerFromFile('bib.test.bib', 'latex');
            const relPath = '../refs.bib';
            const expectedPath = joinFixturePath(relPath).path;
            const result = (manager as any).resolveBibUri(relPath);
            assert.strictEqual(result.path, expectedPath);
        });

        test('fileExists', async () => {
            const manager = await makeManagerWithContent('', 'latex');
            // test with existing file
            const existingUri = joinFixturePath('bib.test.bib');
            const existsResult = await (manager as any).fileExists(existingUri);
            assert.strictEqual(existsResult, true);

            // test with non-existing file
            const nonExistingUri = joinFixturePath('nonexistent.bib');
            const notExistsResult = await (manager as any).fileExists(nonExistingUri);
            assert.strictEqual(notExistsResult, false);
        });
        
        test('readFileAsString', async () => {
            const manager = await makeManagerWithContent('', 'latex');
            const fileUri = joinFixturePath('bib.test.bib');
            
            // indend is intentional (otherwise the test won't work)
            const expectedContent = `
@article{shannon1948,
  title = {A Mathematical Theory of Communication},
  author = {Shannon, C. E.},
  date = {1948-07},
  journaltitle = {The Bell System Technical Journal},
  volume = {27},
  number = {3},
  pages = {379--423},
  issn = {0005-8580},
  doi = {10.1002/j.1538-7305.1948.tb01338.x}
}`;
            const content = await (manager as any).readFileAsString(fileUri);
            assert.strictEqual(content.trim(), expectedContent.trim());
        });

    // unimplemented tests
    // suite('getOpenOptions', () => { });
    // suite('bbtExport', () => { });
    });
});
