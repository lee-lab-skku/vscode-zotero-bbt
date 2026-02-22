
import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import {
    ZoteroDatabase,
} from '../zotero';

suite('ZoteroDatabase', () => {
    /** resolve path for reading files in src/test/resources.test */
    function joinFixturePath(filename: string): vscode.Uri {
        const fixtureDir = path.join(__dirname, '..', '..', 'src', 'test', 'resources.test');
        return vscode.Uri.file(path.join(fixtureDir, filename));
    }
    
    function initZoteroDb(filename: string): ZoteroDatabase {
        const zoteroDbPath = joinFixturePath(filename).path;
        return new ZoteroDatabase({
            zoteroDbPath: zoteroDbPath,
            betterBibtexDbPath: '',
            betterBibtexLegacy: false
        });
    };

    async function parseJsonFile(filename: string): Promise<any> {
        const filePath = joinFixturePath(filename);
        return JSON.parse(
            await vscode.workspace.fs.readFile(filePath).then(buffer => buffer.toString())
        );
    }

    // -------------------------------------------------------------------------
    suite('ZoteroDatabase - Basics', () => {
        test('init and close database', async () => {
            const db = initZoteroDb('zotero.test.sqlite');
            await db.connect();
            assert.strictEqual(db.isConnected(), true);
            
            db.close();
            assert.strictEqual(db.isConnected(), false);
            
        });
        test('connectIfNeeded', async () => {
            const db = initZoteroDb('zotero.test.sqlite');
            await db.connectIfNeeded();
            assert.strictEqual(db.isConnected(), true);
            
            // calling connectIfNeeded again should not throw an error and should keep the connection open
            await db.connectIfNeeded();
            assert.strictEqual(db.isConnected(), true);
            db.close();
            assert.strictEqual(db.isConnected(), false);
        });
    });
    // -------------------------------------------------------------------------
    suite('ZoteroDatabase - Search & Open Items', () => {
        test('search items', async () => {
            const db = initZoteroDb('zotero.test.sqlite');
            await db.connect();
            
            const expectedItems = await parseJsonFile('items.test.json');
            const items = await db.getItems();
            assert.deepStrictEqual(items, expectedItems);
            db.close();
        });

        test('open options', async () => {
            const db = initZoteroDb('zotero.test.sqlite');
            await db.connect();
            
            const expectedItems = await parseJsonFile('open.test.json');
            const items = await db.getOpenOptions('shannon1948');
            assert.deepStrictEqual(items, expectedItems);
            db.close();
        });
    });
});
