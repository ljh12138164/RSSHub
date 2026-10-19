import { parseSync, rawTransferSupported } from 'oxc-parser';

export const parseScriptSource = (source: string, useRawTransfer = true) => {
    const { program, errors } = parseSync('script.js', source, {
        lang: 'js',
        sourceType: 'script',
        preserveParens: false,
        experimentalRawTransfer: useRawTransfer && rawTransferSupported(),
    } as never);
    return { program, errors };
};
