pragma solidity ^0.7.6;

import "@ensdomains/ens/contracts/ENS.sol";

/**
 * A registrar that allocates StealthKey ready subdomains to the first person to claim them.
 * Based on the FIFSRegistrat contract here:
 * https://github.com/ensdomains/ens/blob/master/contracts/FIFSRegistrar.sol
 */
contract StealthKeyFIFSRegistrar {
    ENS public ens;
    bytes32 public rootNode;

    modifier only_owner(bytes32 label) {
        address currentOwner = ens.owner(keccak256(abi.encodePacked(rootNode, label)));
        require(currentOwner == address(0x0) || currentOwner == msg.sender);
        _;
    }

    /**
     * Constructor.
     * @param _ens The address of the ENS registry.
     * @param _rootNode The node that this registrar administers.
     */
    constructor(ENS _ens, bytes32 _rootNode) public {
        ens = _ens;
        rootNode = _rootNode;
    }

    /**
     * Register a name, or change the owner of an existing registration.
     * @param _label The hash of the label to register.
     * @param _owner The address of the new owner.
     */
    function register(bytes32 _label, address _owner) public only_owner(_label) {
        ens.setSubnodeOwner(rootNode, _label, _owner);
    }
}
