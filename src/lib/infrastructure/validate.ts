import Ajv from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import schema from '$lib/core/schema.json';

const ajv = new Ajv({
    allErrors: true,
    strict: false
});

addFormats(ajv);

const validate = ajv.compile(schema);

export function validateProject(data: unknown): {
    valid: boolean;
    errors?: string[];
} {
    const valid = validate(data);

    if (!valid) {
        return {
            valid: false,
            errors: validate.errors?.map((err) => {
                const path = err.instancePath || '/';
                return `${path} ${err.message}`;
            })
        };
    }

    return { valid: true };
}
