var Chain3 = require('chain3')
var solc = require('solc')
var path = require('path')
var fs = require('fs')

var chain3 = new Chain3();
chain3.setProvider(new chain3.providers.HttpProvider('http://localhost:8545'));

var account = {
    adress: "0x7a2dc129b3d794e4e8a009c83ffd7a2412f5e326",
    privateKey: "86736091a441dffeb8656e731474433aaf531c4adab0497fa38d36215f44f18d"
}

deploy();

return;

async function deploy() {

    var contractName = 'StandardToken';
    var solpath = path.resolve(__dirname, "../contract/") + "/" + contractName + '.sol';
    var input = {
        language: 'Solidity',
        sources: {
            'StandardToken.sol': {
                content: fs.readFileSync(solpath, 'utf-8')
            }
        },
        settings: {
            optimizer: {
                // 默认为 disabled
                enabled: true,
                // 基于你希望运行多少次代码来进行优化。
                // 较小的值可以使初始部署的费用得到更多优化，较大的值可以使高频率的使用得到优化。
                runs: 200
            },
            outputSelection: {
                '*': {
                    '*': ['abi', 'evm.bytecode']
                }
            }
        }
    };

    // var input = {
    //     language: 'Solidity',
    //     sources: {
    //         'TestToken.sol': {
    //             content: fs.readFileSync(path.resolve(__dirname, '../contract/') + "/TestToken.sol", 'utf-8')
    //         }
    //     },
    //     settings: {
    //         optimizer: {
    //             // 默认为 disabled
    //             enabled: true,
    //             // 基于你希望运行多少次代码来进行优化。
    //             // 较小的值可以使初始部署的费用得到更多优化，较大的值可以使高频率的使用得到优化。
    //             runs: 200
    //         },
    //         outputSelection: {
    //             '*': {
    //                 '*': ['abi', 'evm.bytecode']
    //             }
    //         }
    //     }
    // };

    var safeMathContract = fs.readFileSync(path.resolve(__dirname, "../contract/") + "/" + 'SafeMath.sol', 'utf-8');
    var IExtendedERC20Contract = fs.readFileSync(path.resolve(__dirname, "../contract/") + "/" + 'IExtendedERC20.sol', 'utf-8');
    // console.log('safeMathContract', safeMathContract);
    // console.log('IExtendedERC20Contract', IExtendedERC20Contract);

    function findImports(pathsol) {
        if (pathsol === 'SafeMath.sol')
            return { contents: safeMathContract };
        else if (pathsol == 'IExtendedERC20.sol')
            return { contents: IExtendedERC20Contract };
        else return { error: 'File not found' };
    }

    var output = JSON.parse(solc.compile(JSON.stringify(input), findImports));
    var abi = output.contracts[contractName + ".sol"][contractName].abi;
    var bin = output.contracts[contractName + ".sol"][contractName].evm.bytecode.object;


    // var output = JSON.parse(solc.compile(JSON.stringify(input)));
    // var abi = output.contracts["TestToken.sol"]['TokenDemo'].abi;
    // var bin = output.contracts["TestToken.sol"]['TokenDemo'].evm.bytecode.object;


    // deployWithMc(abi, bin);
    // return

    var name = 'test for standard erc20 token';
    var symbol = 'TFSERC20';
    var decimals = 18;
    var totalSupply = 123456;
    var types = ['string', 'string', 'uint8', 'uint256'];
    var args = [name, symbol, decimals, totalSupply];
    let parameter = chain3.encodeParams(types, args);

    let rawTx = {
        nonce: chain3.toHex(getNonce(account.adress)),
        gasLimit: chain3.toHex("9000000"),
        gasPrice: chain3.toHex(chain3.mc.gasPrice),
        chainId: chain3.toHex(chain3.version.network),
        data: '0x' + bin + parameter
    };

    // console.log('0x' + bin + parameter)
    try {
        let signtx = chain3.signTransaction(rawTx, account.privateKey);
        var transHash = chain3.mc.sendRawTransaction(signtx);
        console.log('hash:', transHash);
        var tokenAddr = waitBlockForContract(transHash);
        console.log('tokenAddr:', tokenAddr);
    } catch (error) {
        console.log(error)
    }

}

function getNonce(src) {
    var count = chain3.mc.getTransactionCount(src);
    var res = chain3.currentProvider.send({
        id: new Date().getTime(),
        jsonrpc: "2.0",
        method: "txpool_content",
        params: []
    });
    if (res && res.result && res.result.pending) {
        var pendings = res.result.pending;
        if (pendings) {
            const keys = Object.keys(pendings);
            for (const index in keys) {
                /* istanbul ignore else  */
                if (keys.hasOwnProperty(index)) {
                    const key = keys[index];
                    if (key.toLowerCase() === src.toLowerCase()) {
                        count = count + Object.keys(pendings[key]).length;
                    }
                }
            }
        }
    }
    return count;
}

function deployWithMc(abi, bin) {
    var name = 'test for standard erc20 token';
    var symbol = 'TFSE2';
    var decimals = 18;
    var totalSupply = 123456;
    // console.log('abi', abi);
    // console.log('bin', bin);
    var parameter = {
        from: '0x5280c783ed71827bbd1fa750efa23cdec14bbaa6',
        gas: 9000000,
        data: '0x' + bin
    }
    // console.log(parameter)
    var standardTokenContract = chain3.mc.contract(abi);
    standardTokenContract.new(
        // totalSupply,
        // name,
        // decimals,
        // symbol,
        // parameter,
        name,
        symbol,
        decimals,
        totalSupply,
        parameter,
        function (err, myContract) {
            if (!err) {
                // NOTE: The callback will fire twice!
                // Once the contract has the transactionHash property set and once its deployed on an address.

                // e.g. check tx hash on the first call (transaction send)
                if (!myContract.address) {
                    console.log(myContract.transactionHash) // The hash of the transaction, which deploys the contract

                    // check address on the second call (contract deployed)
                } else {
                    console.log(myContract.address) // the contract address
                }

                // Note that the returned "myContractReturned" === "myContract",
                // so the returned "myContractReturned" object will also get the address set.
            } else {
                console.log(err)
            }
        }
    )

}

function waitBlockForContract(transactionHash) {
    console.log("Waiting a mined block to include your contract...");

    while (true) {
        let receipt = chain3.mc.getTransactionReceipt(transactionHash);
        if (receipt && chain3.fromDecimal(receipt.status) == 1 && receipt.contractAddress) {
            console.log("contract has been deployed at " + receipt.contractAddress);
            break;
        } else if (receipt && chain3.fromDecimal(receipt.status) == 0) {
            console.log("contract deploy failed!!!");
            break;
        }
        console.log("block " + chain3.mc.blockNumber + "...");
        sleep(50000);
    }
    return chain3.mc.getTransactionReceipt(transactionHash).contractAddress;
}

function sleep(milliseconds) {
    var start = new Date().getTime();
    for (var i = 0; i < 1e7; i++) {
        if ((new Date().getTime() - start) > milliseconds) {
            break;
        }
    }
}
