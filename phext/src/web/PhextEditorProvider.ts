import * as vscode from 'vscode';
import { Phext, Coordinate } from './Phext';

export class PhextEditorProvider implements vscode.CustomTextEditorProvider {

    constructor(private readonly context: vscode.ExtensionContext) {}

    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        return vscode.window.registerCustomEditorProvider('phext.editor', new PhextEditorProvider(context));
    }

    public async resolveCustomTextEditor(document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel): Promise<void> {
        webviewPanel.webview.options = { enableScripts: true };
        const phext = new Phext();

        webviewPanel.webview.html = this.getHtmlForWebview();

        const content = document.getText();
        const coord = new Coordinate("1.1.1/1.1.1/1.1.1");
        const scroll = phext.fetch(content, coord);
        setTimeout(() => {
            webviewPanel.webview.postMessage({ command: 'displayScroll', scroll });
            webviewPanel.webview.postMessage({ command: 'updateLastKnown', scroll });
        }, 50);

        webviewPanel.webview.onDidReceiveMessage(async message => {
            if (message.command === 'navigate') {
                try {
                    const coord = phext.to_coordinate(message.coordinate);
                    const updatedContent = document.getText();
                    const newScroll = phext.fetch(updatedContent, coord);
                    webviewPanel.webview.postMessage({ command: 'displayScroll', scroll: newScroll });
                    webviewPanel.webview.postMessage({ command: 'updateLastKnown', scroll: newScroll });
                } catch (e) {
                    vscode.window.showErrorMessage("Navigation failed: " + e);
                }
            }
            if (message.command === 'saveScroll') {
                try {
                    const docText = document.getText();
                    const coord = phext.to_coordinate(message.coordinate);
                    const updatedContent = phext.replace(docText, coord, message.scroll);
                    if (updatedContent !== docText) {
                        const edit = new vscode.WorkspaceEdit();
                        const range = new vscode.Range(document.positionAt(0), document.positionAt(docText.length));
                        edit.replace(document.uri, range, updatedContent);
                        await vscode.workspace.applyEdit(edit);
                    }
                } catch (e) {
                    vscode.window.showErrorMessage("Save failed: " + e);
                }
            }
        });
    }

    private getHtmlForWebview(): string {
        return `<!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>Phext Editor</title>
                <style>
                    :root { color-scheme: light dark; }
                    body { font-family: var(--vscode-font-family, sans-serif); margin: 0; height: 100vh; display: flex; flex-direction: column; justify-content: flex-end; background-color: var(--vscode-editor-background); color: var(--vscode-editor-foreground); }
                    .coordinate-bar { background-color: var(--vscode-editorWidget-background); padding: 12px 24px; border-top: 1px solid var(--vscode-editorWidget-border); display: flex; align-items: center; }
                    .coordinate-bar label { margin-right: 16px; font-weight: bold; font-size: 15px; }
                    .coordinate-inputs { display: flex; align-items: center; gap: 6px; }
                    .coordinate-inputs input { width: 45px; height: 30px; text-align: center; font-size: 14px; border-radius: 4px; background-color: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); }
                    .dot, .slash { font-weight: bold; font-size: 18px; line-height: 30px; color: var(--vscode-editor-foreground); }
                    .scroll-display { flex-grow: 1; padding: 16px; overflow-y: auto; border-top: 1px solid var(--vscode-editorWidget-border); white-space: pre-wrap; }
                </style>
            </head>
            <body>
                <div class="scroll-display" id="scrollDisplay" contenteditable="true"></div>
                    <div class="coordinate-bar">
                        <label>Coordinate:</label>
                        <div class="coordinate-inputs">
                            ${Array.from({ length: 9 }, (_, i) => `<input id="c${i+1}" type="text" value="1"/>${[2,5].includes(i) ? '<span class="slash">/</span>' : (i < 8 ? '<span class="dot">.</span>' : '')}`).join('')}
                        </div>
                    </div>
                    <script>
                    const vscode = acquireVsCodeApi();
                    let lastKnownScroll = "";

                    function getCoord() {
                        const parts = Array.from({length: 9}, (_, i) => document.getElementById("c" + (i+1)).value || "1");
                        return \`\${parts[0]}.\${parts[1]}.\${parts[2]}/\${parts[3]}.\${parts[4]}.\${parts[5]}/\${parts[6]}.\${parts[7]}.\${parts[8]}\`;
                    }

                    function sendNavigate() {
                        vscode.postMessage({ command: 'navigate', coordinate: getCoord() });
                    }

                    document.querySelectorAll('.coordinate-inputs input').forEach(input => {
                        input.addEventListener("input", () => {
                            input.value = input.value.replace(/[^0-9]/g, '');
                            if (input.value) sendNavigate();
                        });
                        input.addEventListener("blur", () => {
                            input.value = (parseInt(input.value) || 1).toString();
                            sendNavigate();
                        });
                    });

                    document.getElementById("scrollDisplay").addEventListener("input", () => {
                        const currentContent = document.getElementById("scrollDisplay").innerText;
                        if (currentContent !== lastKnownScroll) {
                            vscode.postMessage({ command: 'saveScroll', coordinate: getCoord(), scroll: currentContent });
                        }
                    });

                    window.addEventListener('message', e => {
                        const m = e.data;
                        if (m.command === 'displayScroll') document.getElementById("scrollDisplay").innerText = m.scroll || "";
                        if (m.command === 'updateLastKnown') lastKnownScroll = m.scroll || "";
                    });
                </script>
            </body>
        </html>`;
    }
}
