// Import the page's CSS. Webpack will know what to do with it.
//import "../stylesheets/app.css";

// Import libraries we need.
import { default as Web3} from 'web3';
import { default as contract } from 'truffle-contract'
import { default as UIkit} from 'uikit'
import { default as Icons} from 'uikit/dist/js/uikit-icons'
import { default as $} from 'jquery'
import uikitcss from "uikit/dist/css/uikit.min.css";
import css from "../index.css";
//import jpg from './app/images/head.jpg'

// Import our contract artifacts and turn them into usable abstractions.
import json from '../../build/contracts/Drolot.json'
var Drolot = contract(json);

UIkit.use(Icons);

window.App = {
    start: function() {
        var self = this;

        Drolot.setProvider(web3.currentProvider);

        Drolot.deployed().then(function(instance) {
            console.log(instance);
            var contract = instance.contract.address;

            /* Events listener from contract */

            var new_player_event = instance.NewPlayer();
            new_player_event.watch(function(error, result){
                if (typeof result != 'undefined'){

                    if (result.args._nplayers == 1){
                        self.clearGame();
                    }
                    self.addPlayer(result.args._from, result.args._nplayers);
                    self.clearWinner();
                    instance.contract.bet.call(function(error, bet){
                        instance.contract.pendingWithdrawals.call(web3.eth.accounts[0], function(e,r){
                            self.refreshWeb3PlayerBalance(r.valueOf(), bet.valueOf());
                        });
                    });
                }
            });

            var winner_event = instance.Winner();

            winner_event.watch(function(error, result){
                if (typeof result != 'undefined'){
                    self.addWinner(result.args._winner);
                    instance.contract.bet.call(function(error, bet){
                        instance.contract.pendingWithdrawals.call(web3.eth.accounts[0], function(e,r){
                            self.refreshWeb3PlayerBalance(r.valueOf(), bet.valueOf());
                        });
                    });
                }
            });

            /* Display web3 or non-web3 interface */

            if (window.web3enabled){
                web3.eth.defaultAccount = web3.eth.accounts[0];
                $(".noweb3").hide();
                instance.contract.bet.call(function(error, bet){
                    instance.contract.pendingWithdrawals.call(web3.eth.accounts[0], function(e,r){
                        self.refreshWeb3PlayerBalance(r.valueOf(), bet.valueOf());
                    });
                });
                $('#web3-play').each(function() {
                    var elem = $(this);
                    elem.bind("click", function(event){
                        instance.contract.bet.call(function(error, result){
				try{
					web3.eth.sendTransaction({from:web3.eth.accounts[0],to: contract, value: result, gas: 100000},
                        function(e,r){self.handleTransaction(e,r);});
				}
				catch (e){
                    console.log(e);
					self.addAlert("We had a problem, if you are using a web3 browser, is you accont unlocked ?");
				}
                        });
                    });
                });
                $('#web3-play-with-balance').each(function() {
                    var elem = $(this);
                    elem.bind("click", function(event){
                        instance.playWithWinnings.sendTransaction({from:web3.eth.accounts[0]}).then(function(r){console.log(r); self.handleTransaction("toto",r);}) ;
                    });

                });
                $('#web3-withdraw').each(function() {
                    var elem = $(this);
                    elem.bind("click", function(event){
                        instance.withdraw.sendTransaction({from:web3.eth.accounts[0]}).then(function(r){console.log(r); self.handleTransaction("toto",r);}) ;
                    });

                });
            }
            else{
                $(".web3").hide();
            }

            /* Event listener for player address input */

            $('#player-balance-address').each(function() {
                var elem = $(this);
                elem.bind("propertychange change click keyup input paste", function(event){
                    self.cleanPlayerBalance();
                    if (web3.isAddress(elem.val().trim())){
                        self.refreshPlayerBalance(web3.fromWei(instance.contract.pendingWithdrawals.call(elem.val().trim()), "ether"));
                    }
                });
            });

            /* */

            var etherscan = "https://etherscan.io/address/";
            var escontract = etherscan.concat(contract, "#code");
            $("#contract-address").append(contract);
            $("#a-contract-address").attr("href", escontract);
            instance.contract.bet.call(function(error, result){$(".bet").append(web3.fromWei(result.valueOf(), "ether"), " &Xi;");});
            instance.contract.lot.call(function(error, result){$(".win").append(web3.fromWei(result.valueOf(), "ether"), " &Xi;");});
            instance.contract.maxPlayers.call(function(error, result){$(".maxplayers").append(result.valueOf());});
            instance.contract.numPlayers.call(function(error, result){$(".numplayers").append(result.valueOf());});

            /* Players in current game */
            instance.contract.numPlayers.call(function(error, nplayers){
                for(var i=0; i < nplayers; i++){
                    instance.contract.players.call(i, function(error, player){
                        self.addPlayer(player);}  );
                }
            });

            /* All the winners */
            instance.contract.birthBlock.call( function(error, birthBlock){
		var drolotMessage = "0x64726f6c6f7457696e6e65720000000000000000000000000000000000000000";
                var filter = web3.eth.filter({fromBlock: birthBlock , toBlock: 'latest',
						address: instance.contract.address,
						topics: [null, null, drolotMessage]});
                var re = /(0x0*)/;
                filter.watch(function(error, result){ self.addAllWinner(result.blockNumber, result.topics[1].replace(re, "")); });
            });
        });

    },

    handleTransaction: function(error, transaction){
        if (typeof transaction != 'undefined') {
            $("#alert").append(`<div class="uk-alert-succes" uk-alert=""><a class="uk-alert-close" uk-close=""></a>
                          <p class="uk-text-center">Transaction pending, you can see it on
                          <a href="https://ropsten.etherscan.io/tx/${transaction}">Etherscan</a></p></div>`);}
        else { console.log('Uh oh, something went wrong');}
    },

    addInfo: function(text){
	$("#alert").append(`<div class="uk-alert-succes" uk-alert="">
          <a class="uk-alert-close" uk-close=""></a>
          <p class="uk-text-center">${text}</p></div>`);
    },

    addAlert: function(text){
	$("#alert").append(`<div class="uk-alert-danger" uk-alert="">
          <a class="uk-alert-close" uk-close=""></a>
          <p class="uk-text-center">${text}</p></div>`);
    },

    cleanPlayerBalance: function() {
        $("#player-balance").children().remove();
    },

    enableWeb3PlayWithBalance: function() {
        $("#web3-play-with-balance").prop('disabled', false);
    },

    refreshWeb3PlayerBalance: function(balance, bet) {
        var b = web3.fromWei(balance, "ether");
        $(".web3-player-balance").empty();
        $(".web3-player-balance").append(`${b} &Xi;`);
        if (balance > bet) {
            $("#web3-play-with-balance").prop('disabled', false);
            $("#web3-withdraw").prop('disabled', false);
        }
    },

    refreshPlayerBalance: function(balance) {
        $("#player-balance").append(`<div>Your balance is ${balance}  &Xi;</div>`);
    },

    refreshBankBalance: function(balance) {
        $("#contract-balance").children().remove();
        $("#contract-balance").append(`<div>${balance} &Xi;</div>`);
    },

    clearWinner: function(player) {
        $("#winner").empty();
    },

    clearGame: function(player) {
        $("#players").empty();
        $("#winner").empty();
    },

    addPlayer: function(player, nplayers) {
        $("#players").append(`<li class="uk-animation-slide-right uk-text-center"><span uk-icon="icon: user; ratio:0.7">&nbsp;</span> ${player}</li>`);
        if (typeof nplayers != 'undefined'){
            $(".numplayers").empty();
            $(".numplayers").append(nplayers.valueOf());
        }
    },

    addWinner: function(winner) {
        $("#winner").append(`<div class="uk-animation-shake"><h3 class="uk-text-center uk-text-primary uk-text-lead">Winner</h3><div class="uk-text-primary uk-text-lead" align="center"><span uk-icon="icon: star; ratio:2">&nbsp;</span>${winner}</div></div>`);
    },

    addAllWinner: function(block, winner) {
        $("#all-winners").append(`<tr><td>${block}</td><td>0x${winner}</td></tr>`);
    }
};


window.addEventListener('load', function() {
    // Checking if Web3 has been injected by the browser (Mist/MetaMask)
    if (typeof web3 !== 'undefined') {
        // Use Mist/MetaMask's provider
        window.web3 = new Web3(web3.currentProvider);
        window.web3enabled = true;
    } else {
        // fallback - use your fallback strategy (local node / hosted node + in-dapp id mgmt / fail)
        //window.web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
        window.web3 = new Web3(new Web3.providers.HttpProvider("https://ropsten.infura.io/cHbRZrapth8QaiDXVxyK"));
        window.web3enabled = false;
    }
    App.start();
});

