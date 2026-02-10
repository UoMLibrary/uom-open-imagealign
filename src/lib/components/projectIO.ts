
export function supportsFileSystemAccess(): boolean {
  return 'showDirectoryPicker' in window;
}


function normalise(name) {
	return name.replace(/^\/+/, '');
}

export async function loadProjectFromFiles(fileMap) {
	const projectFile = fileMap.get('project.json');
	if (!projectFile) throw new Error('No project.json found');

	const text = await projectFile.text();
	const data = JSON.parse(text);

	data.imagePairs = await Promise.all(
		data.imagePairs.map(async (pair) => {
			const imageA = normalise(pair.imageA);
			const imageB = normalise(pair.imageB);

			const fileA = fileMap.get(imageA);
			const fileB = fileMap.get(imageB);

			if (!fileA || !fileB) {
				throw new Error(`Missing image for pair "${pair.id}"`);
			}

			return {
				...pair,
				imageAUrl: URL.createObjectURL(fileA),
				imageBUrl: URL.createObjectURL(fileB),
				thumbAUrl: await createThumbnail(fileA)
			};
		})
	);

	return data;
}

async function createThumbnail(file, maxSize = 160) {
	const img = new Image();
	img.src = URL.createObjectURL(file);

	await img.decode();

	const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);

	const canvas = document.createElement('canvas');
	canvas.width = Math.round(img.width * scale);
	canvas.height = Math.round(img.height * scale);

	const ctx = canvas.getContext('2d');
	ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

	return new Promise((resolve) => {
		canvas.toBlob(
			(blob) => {
				resolve(URL.createObjectURL(blob));
			},
			'image/jpeg',
			0.8
		);
	});
}

export async function saveProjectToDownload(project) {
	const blob = new Blob([JSON.stringify(project, null, 2)], {
		type: 'application/json'
	});

	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = 'project.json';
	a.click();
	URL.revokeObjectURL(url);
}
