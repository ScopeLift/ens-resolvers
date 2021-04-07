const ENS = artifacts.require('@ensdomains/ens/contracts/ENSRegistry.sol');
const PublicResolver = artifacts.require('PublicResolver.sol');
const PublicStealthKeyResolver = artifacts.require('PublicStealthKeyResolver.sol');
const StealthKeyFIFSRegistrar = artifacts.require('StealthKeyFIFSRegistrar.sol');

const namehash = require('eth-ens-namehash');
const sha3 = require('web3-utils').sha3;

const { exceptions } = require('@ensdomains/test-utils');
const { dnsName } = require('./dnsName');

contract('StealthKeyFIFSRegistrar', function (accounts) {

    let label, node;
    let ens, pubResolver, resolver, registrar;
    let [admin, owner, subOwner, other] = accounts

    const SPENDING_KEY = 10;
    const SPENDING_PREFIX = 2;
    const VIEWING_KEY = 20;
    const VIEWING_PREFIX = 3;

    beforeEach(async () => {
        label = sha3('mysubdomain');
        node = namehash.hash('mysubdomain.umbra.eth');

        // Set up ENS
        const ethNode = namehash.hash('eth');
        ens = await ENS.new();
        await ens.setSubnodeOwner('0x0', sha3('eth'), admin, {from: admin});
        assert.equal(admin, await ens.owner(ethNode));

        // Assign umbra.eth ownershhip to 'owner'
        let umbraNode = namehash.hash('umbra.eth');
        await ens.setSubnodeOwner(ethNode, sha3('umbra'), owner, {from: admin});
        assert.equal(owner, await ens.owner(umbraNode));

        // Deploy stealth key forwarding resolver to be used by subdomains
        pubResolver = await PublicResolver.new(ens.address);
        resolver = await PublicStealthKeyResolver.new(ens.address);

        // Deploy the subdomain registrar
        registrar = await StealthKeyFIFSRegistrar.new(ens.address, umbraNode, {from: owner});
    });

    describe('before authorization', () => {
        it('should not have permission to allow submdomain registration', async () => {
            await exceptions.expectFailure(
                registrar.register(
                    label, subOwner, resolver.address, SPENDING_PREFIX, SPENDING_KEY, VIEWING_PREFIX, VIEWING_KEY, {from: subOwner}
                ),
            );
        });
    });

    describe('after authorization', () => {
        beforeEach(async () => {
            // Approve the registrar as an operator for all domains owned by owner
            await ens.setApprovalForAll(registrar.address, true, {from: owner});
            const isApproved = ens.isApprovedForAll(owner, registrar.address);
            assert(isApproved);
        });

        describe('registration', () => {
            it('should allow a subdomain registration', async () => {
                await registrar.register(
                    label, subOwner, resolver.address, SPENDING_PREFIX, SPENDING_KEY, VIEWING_PREFIX, VIEWING_KEY, {from: subOwner}
                );

                assert.equal(subOwner, await ens.owner(node));
                assert.equal(resolver.address, await ens.resolver(node));

                const keys = await resolver.stealthKeys(node)
                assert.equal(keys[0].toNumber(), SPENDING_PREFIX);
                assert.equal(keys[1].toNumber(), SPENDING_KEY);
                assert.equal(keys[2].toNumber(), VIEWING_PREFIX);
                assert.equal(keys[3].toNumber(), VIEWING_KEY);
            });

            it('should not allow subdmoain re-registration', async () => {
                await registrar.register(
                    label, subOwner, resolver.address, SPENDING_PREFIX, SPENDING_KEY, VIEWING_PREFIX, VIEWING_KEY, {from: subOwner}
                );
                assert.equal(subOwner, await ens.owner(node));

                await exceptions.expectFailure(
                    registrar.register(
                        label, other, resolver.address, SPENDING_PREFIX, SPENDING_KEY, VIEWING_PREFIX, VIEWING_KEY, {from: other}
                    ),
                );
            });
        });

        describe('ownership', () => {
            beforeEach(async () => {
                await registrar.register(
                    label, subOwner, resolver.address, SPENDING_PREFIX, SPENDING_KEY, VIEWING_PREFIX, VIEWING_KEY, {from: subOwner}
                );
                assert.equal(subOwner, await ens.owner(node));
            });

            it('should allow a registrant to assign their own resolver', async () => {
                await ens.setResolver(node, pubResolver.address, {from: subOwner});
                assert.equal(pubResolver.address, await ens.resolver(node));
            });

            it('should allow a registrant to transfer ownership', async () => {
                await ens.setOwner(node, other, {from: subOwner});
                assert.equal(other, await ens.owner(node));
            });

            it('should allow a registrant to update their stealth keys', async () => {
                await resolver.setStealthKeys(node, 3, SPENDING_KEY + 1, 2, VIEWING_KEY + 1, {from: subOwner});
                keys = await resolver.stealthKeys(node)
                assert.equal(keys[0].toNumber(), 3);
                assert.equal(keys[1].toNumber(), SPENDING_KEY + 1);
                assert.equal(keys[2].toNumber(), 2);
                assert.equal(keys[3].toNumber(), VIEWING_KEY + 1);
            });

            it('should allow a registrant to set their addr', async ()=> {
                await resolver.methods['setAddr(bytes32,address)'](node, subOwner, {from: subOwner});
                assert.equal(subOwner, await resolver.addr(node));
            });
        });
    });

});