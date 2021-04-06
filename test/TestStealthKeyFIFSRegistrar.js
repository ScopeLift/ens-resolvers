const ENS = artifacts.require('@ensdomains/ens/contracts/ENSRegistry.sol');
const PublicResolver = artifacts.require('PublicResolver.sol');
const ForwardingStealthKeyResolver = artifacts.require('ForwardingStealthKeyResolver.sol');
const StealthKeyFIFSRegistrar = artifacts.require('StealthKeyFIFSRegistrar.sol');

const namehash = require('eth-ens-namehash');
const sha3 = require('web3-utils').sha3;

const { exceptions } = require('@ensdomains/test-utils');
const { dnsName } = require('./dnsName');

contract('StealthKeyFIFSRegistrar', function (accounts) {

    let label, node;
    let ens, pubResolver, resolver, registrar;
    let [admin, owner, subOwner] = accounts

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
        resolver = await ForwardingStealthKeyResolver.new(ens.address, pubResolver.address);

        // Deploy the subdomain registrar
        registrar = await StealthKeyFIFSRegistrar.new(ens.address, umbraNode, {from: owner});
    });

    describe('before authorization', () => {
        it('should not have permission to allow submdomain registration', async () => {
            await exceptions.expectFailure(
                registrar.register(label, subOwner, {from: subOwner}),
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

        it('should allow a subdmoain registration', async () => {
            await registrar.register(label, subOwner, {from: subOwner});
            assert.equal(subOwner, await ens.owner(node));
        });
    });

});