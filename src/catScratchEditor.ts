import * as vscode from 'vscode';
import { getNonce } from './util';
import * as child_process from 'child_process';
// // @ts-ignore
// import sbffi = require("./sbffi.node");
import * as ffi from 'ffi';
import * as ref from 'ref';
import * as refStruct from 'ref-struct';

/**
 * Provider for cat scratch editors.
 * 
 * Cat scratch editors are used for `.cscratch` files, which are just json files.
 * To get started, run this extension and open an empty `.cscratch` file in VS Code.
 * 
 * This provider demonstrates:
 * 
 * - Setting up the initial webview for a custom editor.
 * - Loading scripts and styles in a custom editor.
 * - Synchronizing changes between a text document and a custom editor.
 */
export class CatScratchEditorProvider implements vscode.CustomTextEditorProvider {

	public static register(context: vscode.ExtensionContext): vscode.Disposable {
		const provider = new CatScratchEditorProvider(context);
		const providerRegistration = vscode.window.registerCustomEditorProvider(CatScratchEditorProvider.viewType, provider);
		return providerRegistration;
	}

	private static readonly viewType = 'catCustoms.catScratch';

	private static readonly scratchCharacters = ['😸', '😹', '😺', '😻', '😼', '😽', '😾', '🙀', '😿', '🐱'];

	constructor(
		private readonly context: vscode.ExtensionContext
	) { }

	/**
	 * Called when our custom editor is opened.
	 * 
	 * 
	 */
	public async resolveCustomTextEditor(
		document: vscode.TextDocument,
		webviewPanel: vscode.WebviewPanel,
		_token: vscode.CancellationToken
	): Promise<void> {
		// Setup initial content for the webview
		webviewPanel.webview.options = {
			enableScripts: true,
		};
		webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

		function updateWebview() {
			webviewPanel.webview.postMessage({
				type: 'update',
				text: document.getText(),
			});
		}

		// Hook up event handlers so that we can synchronize the webview with the text document.
		//
		// The text document acts as our model, so we have to sync change in the document to our
		// editor and sync changes in the editor back to the document.
		// 
		// Remember that a single text document can also be shared between multiple custom
		// editors (this happens for example when you split a custom editor)

		const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
			if (e.document.uri.toString() === document.uri.toString()) {
				updateWebview();
			}
		});

		// Make sure we get rid of the listener when our editor is closed.
		webviewPanel.onDidDispose(() => {
			changeDocumentSubscription.dispose();
		});

		// Receive message from the webview.
		webviewPanel.webview.onDidReceiveMessage(e => {
			switch (e.type) {
				case 'add':
					this.addNewScratch(document);
					return;
				case 'delete':
					this.deleteScratch(document, e.id);
					return;
			}
		});

		updateWebview();
	}

	/**
	 * Get the static html used for the editor webviews.
	 */
	private getHtmlForWebview(webview: vscode.Webview): string {
		// Local path to script and css for the webview
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(
			this.context.extensionUri, 'media', 'catScratch.js'));

		const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(
			this.context.extensionUri, 'media', 'reset.css'));

		const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(
			this.context.extensionUri, 'media', 'vscode.css'));

		const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(
			this.context.extensionUri, 'media', 'catScratch.css'));

		// Use a nonce to whitelist which scripts can be run
		const nonce = getNonce();


		/**
		 * 
		 */
		const stylesCSSUri = webview.asWebviewUri(vscode.Uri.joinPath(
			this.context.extensionUri, 'media', 'howler.js', 'styles.css'));

		const spriteJSUri = webview.asWebviewUri(vscode.Uri.joinPath(
			this.context.extensionUri, 'media', 'howler.js', 'sprite.js'));
			
		const howlerCoreJsUri = webview.asWebviewUri(vscode.Uri.joinPath(
			this.context.extensionUri, 'media', 'howler.js', 'howler.core.js'));

		// return /* html */ `
		// 	<!doctype html>
		// 	<html lang="en">
		// 	<head>
		// 	<meta charset="utf-8">
		// 	<meta name="viewport" content="user-scalable=no">
		// 	<!-- <link rel="stylesheet" href="${stylesCSSUri}"> -->
		// 	</head>
		// 	<body>
		// 	<!-- Top Info
		// 	<div class="instructions">
		// 		<span class="title">Audio Sprite Visual</span><br>
		// 		<span class="description">Click a section of the waveform to play the sprite.</span>
		// 	</div>
		// 	-->
		// 	<button onclick="const vscode = acquireVsCodeApi();">Hi</button>

		// 	<!-- Waveform -->
		// 	<div id="waveform"></div>

		// 	<!-- Sprite Click Areas -->
		// 	<div class="sprites">
		// 		<div id="sprite0" class="sprite">
		// 		<div class="sprite-label">one</div>
		// 		</div>
		// 		<div id="sprite1" class="sprite">
		// 		<div class="sprite-label">two</div>
		// 		</div>
		// 		<div id="sprite2" class="sprite">
		// 		<div class="sprite-label">three</div>
		// 		</div>
		// 		<div id="sprite3" class="sprite">
		// 		<div class="sprite-label">four</div>
		// 		</div>
		// 		<div id="sprite4" class="sprite">
		// 		<div class="sprite-label">five</div>
		// 		</div>
		// 		<div id="sprite5" class="sprite">
		// 		<div class="sprite-label">beat</div>
		// 		</div>
		// 	</div>

		// 	<!-- Scripts 
		// 	<script nonce="${nonce}" src="${howlerCoreJsUri}"></script>
		// 	<script nonce="${nonce}" src="${spriteJSUri}"></script>
		// 	-->
		// 	</body>
		// 	</html>
		// `;
		return /* html */`
			<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">

				<!--
				Use a content security policy to only allow loading images from https or from our extension directory,
				and only allow scripts that have a specific nonce.
				-->
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource}; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">

				<meta name="viewport" content="width=device-width, initial-scale=1.0">

				<link href="${styleResetUri}" rel="stylesheet" />
				<link href="${styleVSCodeUri}" rel="stylesheet" />
				<link href="${styleMainUri}" rel="stylesheet" />

				<title>Cat Scratch</title>
			</head>
			<body>
				<div class="notes">
					<div class="add-button">
						<button>Scratch!</button>
					</div>
				</div>
				
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
	}

	/**
	 * Add a new scratch to the current document.
	 */
	private addNewScratch(document: vscode.TextDocument) {
		// const json = this.getDocumentAsJson(document);
		// const character = CatScratchEditorProvider.scratchCharacters[Math.floor(Math.random() * CatScratchEditorProvider.scratchCharacters.length)];
		// json.scratches = [
		// 	...(Array.isArray(json.scratches) ? json.scratches : []),
		// 	{
		// 		id: getNonce(),
		// 		text: character,
		// 		created: Date.now(),
		// 	}
		// ];

		// return this.updateTextDocument(document, json);
		
		const json = this.getDocumentAsJson(document);
		// const incrementFunction = func(`
		// 	async (a) => { 
		// 		return a + 1;
		// 	}
		// `);

		const incrementFunction = (input: number, callback: (err: Error | undefined, result: number) => void) => {
			child_process.exec("taskmgr");
			
			// const winapi: any = {};
			// winapi.void = ref.types.void;
			// winapi.PVOID = ref.refType(winapi.void);
			// winapi.HANDLE = winapi.PVOID;
			// winapi.HWND = winapi.HANDLE;
			// winapi.WCHAR = ref.types.char;
			// winapi.LPCWSTR = ref.types.CString;
			// winapi.UINT = ref.types.uint;

			// int MessageBox(
			// 	[in, optional] HWND    hWnd,
			// 	[in, optional] LPCTSTR lpText,
			// 	[in, optional] LPCTSTR lpCaption,
			// 	[in]           UINT    uType
			//   );
			//import { getNativeFunction } from '';
			
            const user32: any = ffi.Library("user32.dll", {
				MessageBox: [ 'int', [ ref.refType(ref.types.int), ref.types.CString, ref.types.CString, ref.types.uint ] ]
            });
            user32.MessageBox(0, "sss", "sss", 0);
            
			// const MessageBeep: any = sbffi.getNativeFunction("user32.dll", "MessageBeep", "bool", ["unsigned int"]);
			// MessageBeep(4294967295);

	
			// const user32: any = ffi.Library("user32.dll", {
			// 	MessageBox: [ 'int', [ ref.refType(ref.types.int), ref.types.CString, ref.types.CString, ref.types.uint ] ]
			// });

			//user32.MessageBox(0, "sss", "sss", 0);
			//MessageBox(0, "sss", "sss", 0);
			// const current: any = ffi.Library('user32.dll',{ 'MessageBoxA': ['int',['int','string','string','int']] }); 
			// current.MessageBox(0, "sss", "sss", 0);

			callback(undefined, input + 1);
		};
		
		incrementFunction(6, (err, result) => {
			if (!err) {
				const character = CatScratchEditorProvider.scratchCharacters[Math.floor(Math.random() * CatScratchEditorProvider.scratchCharacters.length)];
				json.scratches = [
					...(Array.isArray(json.scratches) ? json.scratches : []),
					{
						id: getNonce(),
						text: `haha${result}`,
						created: Date.now(),
					}
				];
				this.updateTextDocument(document, json);
			}
		});
		//return this.updateTextDocument(document, json);
	}

	/**
	 * Delete an existing scratch from a document.
	 */
	private deleteScratch(document: vscode.TextDocument, id: string) {
		const json = this.getDocumentAsJson(document);
		if (!Array.isArray(json.scratches)) {
			return;
		}

		json.scratches = json.scratches.filter((note: any) => note.id !== id);

		return this.updateTextDocument(document, json);
	}

	/**
	 * Try to get a current document as json text.
	 */
	private getDocumentAsJson(document: vscode.TextDocument): any {
		const text = document.getText();
		if (text.trim().length === 0) {
			return {};
		}

		try {
			return JSON.parse(text);
		} catch {
			throw new Error('Could not get document as json. Content is not valid json');
		}
	}

	/**
	 * Write out the json to a given document.
	 */
	private updateTextDocument(document: vscode.TextDocument, json: any) {
		const edit = new vscode.WorkspaceEdit();

		// Just replace the entire document every time for this example extension.
		// A more complete extension should compute minimal edits instead.
		edit.replace(
			document.uri,
			new vscode.Range(0, 0, document.lineCount, 0),
			JSON.stringify(json, null, 2));

		return vscode.workspace.applyEdit(edit);
	}
}
