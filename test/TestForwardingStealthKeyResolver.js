const ENS = artifacts.require('@ensdomains/ens/contracts/ENSRegistry.sol');
const PublicResolver = artifacts.require('PublicResolver.sol');
const ForwardingStealthKeyResolver = artifacts.require('ForwardingStealthKeyResolver.sol');

const namehash = require('eth-ens-namehash');
const sha3 = require('web3-utils').sha3;

const { exceptions } = require('@ensdomains/test-utils');
const { dnsName } = require('./dnsName');

contract('ForwardingStealthKeyResolver', function (accounts) {

    let node;
    let ens, pubResolver, resolver;

    beforeEach(async () => {
        node = namehash.hash('eth');
        ens = await ENS.new();
        pubResolver = await PublicResolver.new(ens.address);
        resolver = await ForwardingStealthKeyResolver.new(ens.address, pubResolver.address);
        await ens.setSubnodeOwner('0x0', sha3('eth'), accounts[0], {from: accounts[0]});
    });

    describe('stealthKeys', async () => {
        beforeEach(async () => {
            await pubResolver.setAuthorisation(node, resolver.address, true);
        });

        const SPENDING_KEY = 10;
        const VIEWING_KEY = 20;

        it('permits setting stealth keys by owner', async () => {
            await resolver.setStealthKeys(node, 2, SPENDING_KEY, 2, VIEWING_KEY, {from: accounts[0]});
            const keys = await resolver.stealthKeys(node)
            assert.equal(keys[0].toNumber(), 2);
            assert.equal(keys[1].toNumber(), SPENDING_KEY);
            assert.equal(keys[2].toNumber(), 2);
            assert.equal(keys[3].toNumber(), VIEWING_KEY);
        });

        it('can overwrite previously set keys', async () => {
            await resolver.setStealthKeys(node, 3, SPENDING_KEY, 2, VIEWING_KEY, {from: accounts[0]});
            let keys = await resolver.stealthKeys(node)
            assert.equal(keys[0].toNumber(), 3);
            assert.equal(keys[1].toNumber(), SPENDING_KEY);
            assert.equal(keys[2].toNumber(), 2);
            assert.equal(keys[3].toNumber(), VIEWING_KEY);

            await resolver.setStealthKeys(node, 2, SPENDING_KEY + 1, 3, VIEWING_KEY + 1, {from: accounts[0]});
            keys = await resolver.stealthKeys(node)
            assert.equal(keys[0].toNumber(), 2);
            assert.equal(keys[1].toNumber(), SPENDING_KEY + 1);
            assert.equal(keys[2].toNumber(), 3);
            assert.equal(keys[3].toNumber(), VIEWING_KEY + 1);
        });

        it('forbids setting keys by non-owners', async () => {
            await exceptions.expectFailure(
                resolver.setStealthKeys(node, 2, SPENDING_KEY, 2, VIEWING_KEY, {from: accounts[1]})
            );
        });

        it('returns 0 when fetching nonexistent keys', async () => {
            const keys = await resolver.stealthKeys(node)
            assert.equal(keys[0].toNumber(), 3);
            assert.equal(keys[1].toNumber(), 0);
            assert.equal(keys[2].toNumber(), 3);
            assert.equal(keys[3].toNumber(), 0);
        });
    });

    describe('upgrade from public', async () => {
        it('reflects existing state from the public resolver', async () => {
            // Set Public Resolver on ENS registry
            await ens.setResolver(node, pubResolver.address);
            assert.equal(await ens.resolver(node), pubResolver.address);

            // Set and check fields on the public resolver
            await pubResolver.methods['setAddr(bytes32,address)'](node, accounts[1], {from: accounts[0]});
            assert.equal(await pubResolver.methods['addr(bytes32)'](node), accounts[1]);
            await pubResolver.setName(node, 'name1', {from: accounts[0]});
            assert.equal(await pubResolver.name(node), 'name1');

            // Check data is reflected on the forwarding stealth key resolver
            assert.equal(await resolver.methods['addr(bytes32)'](node), accounts[1]);
            assert.equal(await resolver.name(node), 'name1');

            // Authorize the forwarding resolver on the public resolver
            await pubResolver.setAuthorisation(node, resolver.address, true);

            // Set forwarding resolver on ENS registry
            await ens.setResolver(node, resolver.address);
            assert.equal(await ens.resolver(node), resolver.address);

            // Update fields through the forwarding resolver
            await resolver.methods['setAddr(bytes32,address)'](node, accounts[2], {from: accounts[0]});
            assert.equal(await resolver.methods['addr(bytes32)'](node), accounts[2]);
            await resolver.setName(node, 'name2', {from: accounts[0]});
            assert.equal(await resolver.name(node), 'name2');

            // Validate the fields are also updated on the underlying pulbic resolver
            assert.equal(await pubResolver.methods['addr(bytes32)'](node), accounts[2]);
            assert.equal(await pubResolver.name(node), 'name2');
        });
    });

    describe('implementsInterface', async () => {
        beforeEach(async () => {
            await pubResolver.setAuthorisation(node, resolver.address, true);
        });

        it('permits setting interface by owner', async () => {
            await resolver.setInterface(node, "0x12345678", accounts[0], {from: accounts[0]});
            assert.equal(await resolver.interfaceImplementer(node, "0x12345678"), accounts[0]);
        });

        it('can update previously set interface', async () => {
            await resolver.setInterface(node, "0x12345678", resolver.address, {from: accounts[0]});
            assert.equal(await resolver.interfaceImplementer(node, "0x12345678"), resolver.address);
        });

        it('forbids setting interface by non-owner', async () => {
            await exceptions.expectFailure(resolver.setInterface(node, '0x12345678', accounts[1], {from: accounts[1]}));
        });

        it('returns 0 when fetching unset interface', async () => {
            assert.equal(await resolver.interfaceImplementer(namehash.hash("foo"), "0x12345678"), "0x0000000000000000000000000000000000000000");
        });

        it('falls back to calling implementsInterface on addr', async () => {
            // Set addr to the resolver itself, since it has interface implementations.
            await resolver.methods['setAddr(bytes32,address)'](node, resolver.address, {from: accounts[0]});
            // Check the ID for `addr(bytes32)`
            assert.equal(await resolver.interfaceImplementer(node, "0x3b3b57de"), resolver.address);
        });

        it('returns 0 on fallback when target contract does not implement interface', async () => {
            // Check an imaginary interface ID we know it doesn't support.
            assert.equal(await resolver.interfaceImplementer(node, "0x00000000"), "0x0000000000000000000000000000000000000000");
        });

        it('returns 0 on fallback when target contract does not support implementsInterface', async () => {
            // Set addr to the ENS registry, which doesn't implement supportsInterface.
            await resolver.methods['setAddr(bytes32,address)'](node, ens.address, {from: accounts[0]});
            // Check the ID for `supportsInterface(bytes4)`
            assert.equal(await resolver.interfaceImplementer(node, "0x01ffc9a7"), "0x0000000000000000000000000000000000000000");
        });

        it('returns 0 on fallback when target is not a contract', async () => {
            // Set addr to an externally owned account.
            await resolver.methods['setAddr(bytes32,address)'](node, accounts[0], {from: accounts[0]});
            // Check the ID for `supportsInterface(bytes4)`
            assert.equal(await resolver.interfaceImplementer(node, "0x01ffc9a7"), "0x0000000000000000000000000000000000000000");
        });
    });
});