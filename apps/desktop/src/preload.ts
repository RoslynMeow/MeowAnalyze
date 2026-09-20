import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("meow", {
  openFolder: () => ipcRenderer.invoke("meow:openFolder"),
});
