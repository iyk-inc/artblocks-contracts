var prompt = require("prompt-sync")();
const GenArt721Minter = require("../artifacts/GenArt721Minter.json");
const { BigNumber } = require("ethers");
var utils = require("ethers").utils;

async function main() {
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  console.log("Minting:", deployerAddress);

  const genArt721Address = "0x2251f7Dad12C25B233B6d51453Be5Da6D925Fad8"; //prompt('Minter address? ');
  const genArt721Minter = new ethers.Contract(
    genArt721Address,
    GenArt721Minter.abi,
    deployer //provider
  );

  await genArt721Minter.purchase("3", { value: utils.parseEther("0.1") });

  console.log("mint done");
  //let supply = await genArt721.totalSupply();
  //console.log("supply:" +supply);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
