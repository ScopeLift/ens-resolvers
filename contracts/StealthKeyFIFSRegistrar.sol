pragma solidity ^0.7.6;

import "@ensdomains/ens/contracts/ENS.sol";
import "./profiles/StealthKeyResolver.sol";

/**
 * A registrar that allocates StealthKey ready subdomains to the first person to claim them.
 * Based on the FIFSRegistrat contract here:
 * https://github.com/ensdomains/ens/blob/master/contracts/FIFSRegistrar.sol
 */
contract StealthKeyFIFSRegistrar {
    ENS public ens;
    StealthKeyResolver public resolver;
    bytes32 public rootNode;

    /**
     * Constructor.
     * @param _ens The address of the ENS registry.
     * @param _rootNode The node that this registrar administers.
     */
    constructor(ENS _ens, StealthKeyResolver _resolver, bytes32 _rootNode) {
        ens = _ens;
        resolver = _resolver;
        rootNode = _rootNode;
    }

    /**
     * Register a name, or change the owner of an existing registration.
     * @param _label The hash of the label to register.
     * @param _owner The address of the new owner.
     * @param _spendingPubKeyPrefix Prefix of the spending public key (2 or 3)
     * @param _spendingPubKey The public key for generating a stealth address
     * @param _viewingPubKeyPrefix Prefix of the viewing public key (2 or 3)
     * @param _viewingPubKey The public key to use for encryption
     */
    function register(
        bytes32 _label,
        address _owner,
        uint256 _spendingPubKeyPrefix,
        uint256 _spendingPubKey,
        uint256 _viewingPubKeyPrefix,
        uint256 _viewingPubKey
    ) public {
        // calculate the node for this subdomain
        bytes32 _node = keccak256(abi.encodePacked(rootNode, _label));

        // ensure the subdomain has not yet been claimed
        address _currentOwner = ens.owner(_node);
        require(_currentOwner == address(0x0), 'StealthKeyFIFSRegistrar: Already claimed');

        // temporarily make this contract the subnode owner to allow it to update the stealth keys
        ens.setSubnodeOwner(rootNode, _label, address(this));
        resolver.setStealthKeys(_node, _spendingPubKeyPrefix, _spendingPubKey, _viewingPubKeyPrefix, _viewingPubKey);

        // transfer ownership to the registrant and set stealth key resolver
        ens.setSubnodeRecord(rootNode, _label, _owner, address(resolver), 0);
    }
}
