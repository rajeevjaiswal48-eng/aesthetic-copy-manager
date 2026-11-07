let sourceDirHandle = null;
let destDirHandle = null;
let appClipboard = [];

document.getElementById('btnSource').addEventListener('click', async () => {
  try {
    sourceDirHandle = await window.showDirectoryPicker();
    document.getElementById('sourceLabel').innerText = sourceDirHandle.name;
    renderFiles(sourceDirHandle);
  } catch (e) { console.log("Picker cancelled"); }
});

document.getElementById('btnDest').addEventListener('click', async () => {
  try {
    destDirHandle = await window.showDirectoryPicker();
    document.getElementById('destLabel').innerText = destDirHandle.name;
  } catch (e) { console.log("Picker cancelled"); }
});

async function renderFiles(dirHandle) {
  const listElement = document.getElementById('fileList');
  listElement.innerHTML = '';
  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'file') {
      const item = document.createElement('div');
      item.className = "p-1.5 hover:bg-white/5 rounded transition cursor-pointer select-none text-gray-200 active:bg-white/10";
      item.innerText = `📄 ${entry.name}`;
      item.onclick = () => {
        document.querySelectorAll('#fileList div').forEach(d => d.classList.remove('border', 'border-teal-400'));
        item.classList.add('border', 'border-teal-400');
        item.dataset.selectedFile = entry.name;
      };
      listElement.appendChild(item);
    }
  }
}

window.addEventListener('keydown', async (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
    const selected = document.querySelector('[data-selected-file]');
    if (selected && sourceDirHandle) {
      const fileHandle = await sourceDirHandle.getFileHandle(selected.dataset.selectedFile);
      appClipboard = [fileHandle]; 
    }
  }

  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
    if (appClipboard.length > 0 && destDirHandle) {
      e.preventDefault();
      for (const fileHandle of appClipboard) {
        await executeChunkedCopy(fileHandle, destDirHandle);
      }
    }
  }
});

async function executeChunkedCopy(sourceHandle, destinationDirHandle) {
  const panel = document.getElementById('progressPanel');
  const statusTxt = document.getElementById('transferStatus');
  const percentTxt = document.getElementById('transferPercent');
  const bar = document.getElementById('progressBar');
  const speedTxt = document.getElementById('transferSpeed');
  const etaTxt = document.getElementById('transferETA');

  panel.classList.remove('hidden');
  statusTxt.innerText = `Copying: ${sourceHandle.name}`;

  const file = await sourceHandle.getFile();
  const totalBytes = file.size;
  let copiedBytes = 0;

  const destFileHandle = await destinationDirHandle.getFileHandle(file.name, { create: true });
  const writable = await destFileHandle.createWritable();
  const reader = file.stream().getReader();

  const startTime = performance.now();
  let lastTime = startTime;
  let lastBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    await writable.write(value);
    copiedBytes += value.length;

    const currentTime = performance.now();
    const timeDelta = (currentTime - lastTime) / 1000;

    if (timeDelta >= 0.25 || copiedBytes === totalBytes) { 
      const currentSpeedMBps = ((copiedBytes - lastBytes) / (1024 * 1024)) / timeDelta;
      const progressPercent = Math.min((copiedBytes / totalBytes) * 100, 100);
      const remainingBytes = totalBytes - copiedBytes;
      const etaSeconds = currentSpeedMBps > 0 ? (remainingBytes / (1024 * 1024)) / currentSpeedMBps : 0;

      bar.style.width = `${progressPercent}%`;
      percentTxt.innerText = `${Math.round(progressPercent)}%`;
      speedTxt.innerText = `${currentSpeedMBps.toFixed(1)} MB/s`;
      etaTxt.innerText = etaSeconds > 0 ? `${Math.ceil(etaSeconds)}s` : 'Done';

      lastTime = currentTime;
      lastBytes = copiedBytes;
    }
  }

  await writable.close();
  statusTxt.innerText = `Finished copying ${sourceHandle.name}!`;
  setTimeout(() => panel.classList.add('hidden'), 3000);
}
