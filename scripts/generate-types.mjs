import { compileFromFile } from 'json-schema-to-typescript';
import { writeFile } from 'fs/promises';

const schemaPath = './src/lib/domain/project/schema.json';
const outPath = './src/lib/domain/project/types.ts';

const ts = await compileFromFile(schemaPath, {
	bannerComment: '/* THIS FILE IS AUTO-GENERATED — DO NOT EDIT MANUALLY */',
	style: {
		singleQuote: true
	}
});

await writeFile(outPath, ts);
console.log('✓ Types generated:', outPath);
