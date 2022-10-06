// SPDX-License-Identifier: LGPL-3.0-only
// Created By: Art Blocks Inc.

import "./GenArt721CoreV2_PBAB.sol";

import "@openzeppelin-4.5/contracts/utils/cryptography/ECDSA.sol";

pragma solidity 0.8.9;

/**
 * @title Powered by Art Blocks ERC-721 core contract.
 * Support for IYK pull mechanism to transfer tokens based on verified signatures
 * @author Art Blocks Inc.
 */
contract GenArt721CoreV2_IYK is GenArt721CoreV2_PBAB {
    using ECDSA for bytes32;

    // Expected signer of claim signatures
    address public signVerifier;

    // Nonce per user, used to prevent replay signature attacks
    mapping(address => uint256) public claimNonces;

    /**
     * @notice Initializes contract.
     * @param _tokenName Name of token.
     * @param _tokenSymbol Token symbol.
     * @param _randomizerContract Randomizer contract.
     * @param _startingProjectId The initial next project ID.
     * @dev _startingProjectId should be set to a value much, much less than
     * max(uint256) to avoid overflow when adding to it.
     */
    constructor(
        string memory _tokenName,
        string memory _tokenSymbol,
        address _randomizerContract,
        uint256 _startingProjectId
    )
        GenArt721CoreV2_PBAB(
            _tokenName,
            _tokenSymbol,
            _randomizerContract,
            _startingProjectId
        )
    {
        signVerifier = 0xfC95c9Ffba80CB60f76C653EA8E5CE01253b6C6a;
    }

    /**
     * @notice Transfers a token from its owner to the recipient
     * @param _sig The ECDSA signature signer by the signVerifier
     * @param _blockExpiry As of which block the signature is no longer valid
     * @param _recipient The address who receives the token
     * @param _tokenId The tokenId being claimed
     * @dev ECDSA signatures are used to verify the permission to claim a NFT
     */
    function claimNFT(
        bytes memory _sig,
        uint256 _blockExpiry,
        address _recipient,
        uint256 _tokenId
    ) public virtual {
        bytes32 message = getClaimSigningHash(
            _blockExpiry,
            _recipient,
            _tokenId
        ).toEthSignedMessageHash();
        require(
            ECDSA.recover(message, _sig) == signVerifier,
            "Permission to call this function failed"
        );
        require(block.number < _blockExpiry, "Sig expired");

        address from = ownerOf(_tokenId);
        require(from != address(0));

        claimNonces[_recipient]++;

        _safeTransfer(from, _recipient, _tokenId, "");
    }

    /**
     * @notice Updates the signVerifier to a new relayer address
     * @param _verifier The ECDSA signature signer by the signVerifier
     * @dev This verifier is who signers the ECDSA signatures used by claimNFT
     */
    function setSignVerifier(address _verifier) external virtual onlyAdmin {
        signVerifier = _verifier;
    }

    /**
     * @notice Returns the current claim nonce of a address
     * @param _recipient The address whose nonce is being fetched
     * @return nonce The addresses current nonce
     * @dev This view exposes the nonce as it will be required for the signature.
     * By including a nonce in the signature and updating the nonce on every claim,
     * we prevent replay signature attacks, as signatures can only be used once.
     */
    function getClaimNonce(address _recipient)
        external
        view
        virtual
        returns (uint256)
    {
        return claimNonces[_recipient];
    }

    /**
     * @notice Returns the hash that we expect was signed in claimNFT.
     * @param _blockExpiry As of which block the signature is no longer valid
     * @param _recipient The address who receives the token
     * @param _tokenId The tokenId being claimed
     * @return hash A bytes32 hash that is signed by the signVerifier
     * @dev claimNFT uses this view to get the expected message to have been signed.
     */
    function getClaimSigningHash(
        uint256 _blockExpiry,
        address _recipient,
        uint256 _tokenId
    ) public view virtual returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    _blockExpiry,
                    _recipient,
                    _tokenId,
                    address(this),
                    claimNonces[_recipient]
                )
            );
    }

    /**
     * @notice Returns the address who signs messages granting permission to pull a token into a users wallet.
     * @return signVerifier The address of the sign verifier
     */
    function getSignVerifier() external view virtual returns (address) {
        return signVerifier;
    }

    /**
     * @notice transferFrom has been overriden to make it useless
     * @dev Behavior replaced by pull mechanism in claimNFT
     */
    function transferFrom(
        address _from,
        address _to,
        uint256 _tokenId
    ) public virtual override {}

    /**
     * @notice safeTransferFrom has been overriden to make it useless
     * @dev Behavior replaced by pull mechanism in claimNFT
     */
    function safeTransferFrom(
        address _from,
        address _to,
        uint256 _tokenId
    ) public virtual override {}

    /**
     * @notice safeTransferFrom has been overriden to make it useless
     * @dev Behavior replaced by pull mechanism in claimNFT
     */
    function safeTransferFrom(
        address _from,
        address _to,
        uint256 _tokenId,
        bytes memory _data
    ) public virtual override {}
}
