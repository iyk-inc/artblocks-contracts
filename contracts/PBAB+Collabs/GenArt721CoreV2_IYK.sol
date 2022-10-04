// SPDX-License-Identifier: LGPL-3.0-only
// Created By: Art Blocks Inc.

import "./GenArt721CoreV2_PBAB.sol";

import "@openzeppelin-4.5/contracts/utils/cryptography/ECDSA.sol";

pragma solidity 0.8.9;

/**
 * @title Powered by Art Blocks ERC-721 core contract.
 * Allows IYK pull chemism to transfer tokens based on verified signatures
 * @author Art Blocks Inc.
 */
contract GenArt721CoreV2_IYK is GenArt721CoreV2_PBAB {
    using ECDSA for bytes32;

    address public signVerifier;

    mapping(address => uint256) public claimNonces;

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
        signVerifier = 0xF504941EF7FF8f24DC0063779EEb3fB12bAc8ab7;
    }

    function getClaimNonce(address recipient)
        external
        view
        virtual
        returns (uint256)
    {
        return claimNonces[recipient];
    }

    function getClaimSigningHash(
        uint256 blockExpiry,
        address recipient,
        uint256 tokenId
    ) public view virtual returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    blockExpiry,
                    recipient,
                    tokenId,
                    address(this),
                    claimNonces[recipient]
                )
            );
    }

    function getSignVerifier() external view virtual returns (address) {
        return signVerifier;
    }

    function setSignVerifier(address verifier) external virtual onlyAdmin {
        signVerifier = verifier;
    }

    function claimNFT(
        bytes memory sig,
        uint256 blockExpiry,
        address recipient,
        uint256 tokenId
    ) public virtual {
        bytes32 message = getClaimSigningHash(blockExpiry, recipient, tokenId)
            .toEthSignedMessageHash();
        require(
            ECDSA.recover(message, sig) == signVerifier,
            "Permission to call this function failed"
        );
        require(block.number < blockExpiry, "Sig expired");

        address from = ownerOf(tokenId);
        require(from != address(0));

        claimNonces[recipient]++;

        _safeTransfer(from, recipient, tokenId, "");
    }

    // Override transfer from functions and make them useless
    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public virtual override {}

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public virtual override {}

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes memory _data
    ) public virtual override {}
}
