module.exports = {
    dnsName: (name) => {
        // strip leading and trailing .
        const n = name.replace(/^\.|\.$/gm, '');

        var bufLen = (n === '') ? 1 : n.length + 2;
        var buf = Buffer.allocUnsafe(bufLen);

        offset = 0;
        if (n.length) {
            const list = n.split('.');
            for (let i = 0; i < list.length; i++) {
                const len = buf.write(list[i], offset + 1)
                buf[offset] = len;
                offset += len + 1;
            }
        }
        buf[offset++] = 0;
        return '0x' + buf.reduce((output, elem) => (output + ('0' + elem.toString(16)).slice(-2)), '');
    },
};
