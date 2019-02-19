/*
Skriv denne kommando i terminalen:
node bridge.js
*/

// input til at sende tekst beskeder til Unity VR
let textInput;

let unityHostInputField;

let connectedStatus = 0;

let resultPre;
let connectButton;

let containerSection;

let socket;


var song;

//Alle slidere gemmes i et array, så de senere kan manipuleres samlet
let listeningSliders = [];
let lightIntensitySlider;

//Slidere til lysets retning oprettes som objekter
let lightDirectionSliders = {};
let lockSlider;

//Vi sætter alle konfigurationsoplysninger i et array 
//Lytter (fx på beskeder fra wekinator) på port 11000
//Sender beskeder til Unity på port 12000
//Sender beskeder til en evt låsemekanisme på åport 10330
//IP'erne kan være lokale eller over netværk - doesn't matter

let bridgeConfig = {
	local: {
        //Her sætter vi scriptet til at modtage OSC på localhost:11000
		port: 11000,
		host: '127.0.0.1'
	},
	remotes: [{
        //Unity modtager OSC på den ip adresse den siger: 12000
			name: "unity",
			port: 12000,
			host: '10.138.65.221'
		},
		{
            //Hvis i har et processing skitse tilknyttet en arduino skal i programmere den til at OSC på port 10330
			name: "arduino",
			port: 10330,
			host: '192.168.8.105'
		}
	]
};

function touchStarted() {
  if (getAudioContext().state !== 'running') {
    getAudioContext().resume();
  }
}

function mousePressed() {
  if ( song.isPlaying() ) { // .isPlaying() returns a boolean
    song.stop();
    background(255,0,0);
  } else {
    song.play();
    background(0,255,0);
  }
}
function setup() {
    song = loadSound('lyde/lyd.mp3');
	setupOsc(); //Begynd at lytte efter OSC
    

	// Page container

	containerSection = createElement("section", "").addClass("container");

	// Unity adresse

	createElement("h3", "Unity netværksadresse")
		.parent(containerSection);

    //Den løber igennem konfigurations json og sætter det på severen
	let unityConfig = bridgeConfig.remotes.filter(r => r.name === "unity")[0];
	unityHostInputField = createElement("p", unityConfig.host + ":" + unityConfig.port)
		.parent(containerSection);

	/* VIRKER IKKE
	connectButton = createButton("Forbind")
		.parent(containerSection)
		.changed(() => {
			bridgeConfig.client.host = unityHostInputField.value();
			socket.emit('config', bridgeConfig);
		})
	*/

	// Arudino adresse

	createElement("h3", "Arudino netværksadresse")
		.parent(containerSection);

	let arduinoConfig = bridgeConfig.remotes.filter(r => r.name === "arduino")[0];
	unityHostInputField = createElement("p", arduinoConfig.host + ":" + arduinoConfig.port)
		.parent(containerSection);

	// Tekst besked

	createElement("h3", "Tekstbesked til spiller")
		.parent(containerSection);

	textInput = createInput()
		.parent(containerSection)
		.changed((e) => {
			console.log(textInput.value());
			sendOsc("/text", textInput.value());
		});

	// Blik

	createElement("h3", "Lås")
		.parent(containerSection);

	lockSlider = createSlider(0, 1, 1)
		.parent(containerSection);

	lockSlider.elt.addEventListener('input', () => {
		sendOsc("/lock", lockSlider.value());
	});

	listeningSliders.push({
		slider: lockSlider,
		address: "/looking",
		index: 0,
		parseValue: (val) => {return 1.0-val} // negate looking value
	});


	// Lys

	createElement("h3", "Lys")
		.parent(containerSection);

	// Lys / Intensitet

	createElement("h5", "Intensitet")
		.parent(containerSection);

	lightIntensitySlider = createSlider(0, 80 * 100, 400)
		.parent(containerSection);

	lightIntensitySlider.elt.addEventListener('input', () => {
		sendOsc("/light/intensity", lightIntensitySlider.value());
	});

	listeningSliders.push({
		slider: lightIntensitySlider,
		address: "/wek/outputs",
		index: 0
	});

	// Lys / Retning

	createElement("h5", "Retning")
		.parent(containerSection);

	lightDirectionSliders.x = createSlider(-180 * 100, 180 * 100, 0)
		.parent(containerSection);
	lightDirectionSliders.x.elt.addEventListener('input', () => {
		sendOsc("/light/direction", [lightDirectionSliders.x.value(), lightDirectionSliders.y.value(), lightDirectionSliders.z.value()]);
	});
	listeningSliders.push({
		slider: lightDirectionSliders.x,
		address: "/wek/outputs",
		index: 1
	});

	lightDirectionSliders.y = createSlider(-180 * 100, 180 * 100, 0)
		.parent(containerSection);
	lightDirectionSliders.y.elt.addEventListener('input', () => {
		sendOsc("/light/direction", [lightDirectionSliders.x.value(), lightDirectionSliders.y.value(), lightDirectionSliders.z.value()]);
	});
	listeningSliders.push({
		slider: lightDirectionSliders.y,
		address: "/wek/outputs",
		index: 2
	});

	lightDirectionSliders.z = createSlider(-180 * 100, 180 * 100, 0)
		.parent(containerSection);
	lightDirectionSliders.z.elt.addEventListener('input', () => {
		sendOsc("/light/direction", [lightDirectionSliders.x.value(), lightDirectionSliders.y.value(), lightDirectionSliders.z.value()]);
	});
	listeningSliders.push({
		slider: lightDirectionSliders.z,
		address: "/wek/outputs",
		index: 3
	});

	// Seneste OSC input

	createElement("h3", "Seneste OSC Input")
		.parent(containerSection);

	resultPre = createElement('pre', 'Intet input endnu')
		.parent(containerSection); // a div for the Hue hub's responses
}

/*
Nedenstående er OSC funktioner. 
*/

function receiveOsc(address, value) {
        
	if (address.split('/')[1] === "wek") {
		// besked fra Wekinator
	}

    if (address.split('/')[1] === "looking") {
		// besked fra Unity
        value = ("SPIL DEN LYD");
        song.play();
        
        
	}

	resultPre.html(address + "   " + value + '\n' + resultPre.html());

	//Her løber vi alle slidere igennem
	listeningSliders.map(s => {
		//Hvis adressen svarer til sliderens adresse (fx wek/outputs)
		if (address === s.address) {
			//Hvis der er en værdi i value arrayet
			if (value[s.index]) {

				if(s.parseValue){
					value[s.index] = s.parseValue(value[s.index]);
				}

				//let sliderValue = map(value[s.index], 0.0, 1.0, s.slider.elt.min, s.slider.elt.max);
				let sliderValue = map(value[s.index], 0.0, 1.0, -18000, 18000);
				console.log("slider " + s.index + " got value", value[s.index] + " map returns " + sliderValue);
				s.slider.elt.value = sliderValue;
				var event = new Event('input', {
					'bubbles': true,
					'cancelable': true
				});

				s.slider.elt.dispatchEvent(event);

			}
		}
	});

}

function logOscInput(string) {
	resultPre.html(address + "   " + value + '\n' + resultPre.html());
}

function sendOsc(address, value) {
	socket.emit('message', [address].concat(value));
}

function setupOsc() {
	socket = io.connect('http://127.0.0.1:8081', {
		port: 8081,
		rememberTransport: false
	});
	socket.on('connect', function () {
		socket.emit('config', bridgeConfig);
	});
	socket.on('connected', function (msg) {
		connectedStatus = msg;
		console.log("socket says we're conncted to osc", msg);
	});
	socket.on('message', function (msg) {
		console.log("client socket got", msg);
		if (msg[0] == '#bundle') {
			for (var i = 2; i < msg.length; i++) {
				receiveOsc(msg[i][0], msg[i].splice(1));
			}
		} else {
			receiveOsc(msg[0], msg.splice(1));
		}
	});
}
