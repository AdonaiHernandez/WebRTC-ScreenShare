boton = document.getElementById("button");
botonWs = document.getElementById("button1");
botonPeer = document.getElementById("button2");
video = document.getElementById("video");
nombre = document.getElementById("name");
selector = document.getElementById("codecs");
checkbox = document.getElementById("useCodec");

preferedCodec = "video/VP9";
isChecked = false;
availableCodecs = [];

conexiones = {}


window.onload = () => {

    let codecs = RTCRtpReceiver.getCapabilities('video').codecs;

    for (i = 0; i < codecs.length; i++ ){
        codecs[i]["payloadType"] = "dynamic";
    }

    availableCodecs = codecs;

    codecs.forEach((codec) => {

        let opcion = document.createElement("option");
        opcion.setAttribute("value", codec.mimeType);
        opcion.appendChild(document.createTextNode(codec.mimeType));

        selector.appendChild(opcion);

    })

}

checkbox.onchange = () => {

    isChecked = checkbox.checked;
    console.log(isChecked);

}


selector.onchange = () => {

    valor = selector.value;
    preferedCodec = valor;
    console.log(valor)

}


rtcConfiguration = {iceServers: [
    {
        urls: "stun:stun.relay.metered.ca:80",
      },
      {
        urls: "turn:standard.relay.metered.ca:80",
        username: "1ea74f6473caed509531ec71",
        credential: "44XB2/aEcDFpyxlN",
      },
      {
        urls: "turn:standard.relay.metered.ca:80?transport=tcp",
        username: "1ea74f6473caed509531ec71",
        credential: "44XB2/aEcDFpyxlN",
      },
      {
        urls: "turn:standard.relay.metered.ca:443",
        username: "1ea74f6473caed509531ec71",
        credential: "44XB2/aEcDFpyxlN",
      },
      {
        urls: "turns:standard.relay.metered.ca:443?transport=tcp",
        username: "1ea74f6473caed509531ec71",
        credential: "44XB2/aEcDFpyxlN",
      }

]};

localRTC = null;
stream = null;
host = false;
ws = null;
firstRTC = true;
localName = "";

const constraints = {
    audio: false, // mandatory.
    video: {'mandatory': {'chromeMediaSource':'screen'}}
};

boton.onclick = async () => {

    mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
            cursor: "always",
            width: 1920,
            height: 1080,
            maxWidth: 1920,
            maxHeight: 1080,
            minFrameRate: 60
        },
        audio: true
    });

    stream = mediaStream;
    nombre.value = "host";
    nombre.disabled = true;
    host = true;

}

botonWs.onclick = async () => {
    ip =  window.location.host;
    ws = new WebSocket("wss://"+ip+":443");

    ws.onopen = () => {
        msg = {
            type : 0,
            host : host,
            name : nombre.value
        }
        ws.send(JSON.stringify(msg));
        console.log("conectadoServer");
        localName = nombre.value;
        
    }

    ws.onmessage = (e) => {
        console.log(performance.now());
        let msg = JSON.parse(e.data);
        console.log(msg);
        if (msg.subtype == "peers"){
            crearPeers(msg);
        }
        if (msg.subtype == "video-offer"){
            if (host)
                recivirOfertaHost(msg);
            else
                recivirOferta(msg);    
        }
        if (msg.subtype == "answer"){
            if (host)
                recivirAnswerHost(msg);
            else
                recivirAnswer(msg);
        }
        if (msg.subtype == "new-ice-candidate"){
            handleNewICECandidateMsg(msg);
        }
    }

    ws.onclose = () => {
        console.log("cerrado");
    }

    

}

function crearPeers({peers}){
    if (!host)
        return createClient();

    for (i in peers){
      
        startPeer(peers[i]);

    }
}

function startPeer(peerName){
    conexiones[peerName] = new RTCPeerConnection(rtcConfiguration);
    conexiones[peerName].onicecandidate = (e) => {
        e.to = peerName;
        handleICECandidateEvent(e)
    };
    conexiones[peerName].ontrack = handleTrackEvent; 
    
    stream.getTracks().forEach(track => {
        conexiones[peerName].addTransceiver(track, {
            direction: "sendonly",
            streams: [stream],
            sendEncodings: [
                {
                    priority: "high",
                    maxBitrate: 50000000,
                    maxFramerate: 60,
                    maxWidth: 1920,
                    maxHeight: 1080
                }
            ]
        });
        
    });

    
    forceVP9(conexiones[peerName]);
    
    crearOferta(peerName);
}

function createClient(){
    conexiones["host"] = new RTCPeerConnection(rtcConfiguration);
    conexiones["host"].onicecandidate = (e) => {
        e.to = "host";
        handleICECandidateEvent(e)
    };
    conexiones["host"].ontrack = handleTrackEvent;
    
}

function crearOferta(peerName) {
    console.log("crearOferta")
    conexiones[peerName]
      .createOffer()
      .then((offer) => conexiones[peerName].setLocalDescription(offer))
      .then(() => {
        
        console.log(conexiones[peerName].localDescription);
        msg = {
            type : 1,
            subtype: "video-offer",
            sdp: conexiones[peerName].localDescription,
            name : nombre.value,
            to: peerName
        }

        ws.send(JSON.stringify(msg));

      })
      .catch(reportError);
}

function recivirOfertaHost({sdp, name}){
    console.log("recivirOferta Host");

}

function recivirOferta({sdp, name, to}){
    if (name != "host")
        return;
    if (to != localName)
        return;
    console.log("recivirOferta");

    conexiones[name].setRemoteDescription(sdp);
    conexiones[name]
      .createAnswer()
      .then((offer) => conexiones[name].setLocalDescription(offer))
      .then(() => {
        

        msg = {
            type : 1,
            subtype: "answer",
            sdp: conexiones[name].localDescription,
            name : nombre.value,
            to: to
        }

        ws.send(JSON.stringify(msg));

      })
      .catch(reportError);

}

function recivirAnswerHost({sdp, name}){
    console.log("recivirAnswerHost");
    conexiones[name].setRemoteDescription(sdp);
}

function recivirAnswer({sdp, name, to}){
    if (name != "host")
        return;
    if (to != localName)
        return;   
    console.log("recivirAnswer")
         
    conexiones[name].setRemoteDescription(sdp);
    msg = {
        type : 1,
        subtype: "answer",
        sdp: conexiones[name].localDescription,
        name : nombre.value,
        to: to
    }
    if (host){
        ws.send(JSON.stringify(msg));
    }
}


function handleICECandidateEvent(event) {
    console.log("iceCandida");
    console.log(event);
    if (event.candidate) {

        msg = {
            type : 1,
            subtype: "new-ice-candidate",
            candidate: event.candidate,
            name : nombre.value,
            to: event.to
        }

        ws.send(JSON.stringify(msg));
    }
}

function handleNewICECandidateMsg(msg) {

    if (!host && msg.name != "host")
        return;
    if (msg.to != localName)
        return;    
    const candidate = new RTCIceCandidate(msg.candidate);
    console.log("newiceCand");

    conexiones[msg.name].addIceCandidate(candidate).catch(reportError);
    /*if (stream){
        stream.getTracks().forEach(track => {
            conexiones[msg.name].addTrack(track);
        });
    }*/
}

function handleTrackEvent(event) {
    console.log("track");
    let gotStream = event.streams[0];
    if (gotStream){
        video.srcObject = gotStream; 
    } else {
        
        if (!video.srcObject){
            let remoteStream = new MediaStream();
            remoteStream.addTrack(event.track);
            video.srcObject = remoteStream; 
        } else {
            video.srcObject.addTrack(event.track);
        }
        
    }
    console.log(event);
    
    
}

function forceVP9(actPeer){

    let tcvr = actPeer.getTransceivers()[0];
    if (!tcvr)
        return
    let codecs = RTCRtpReceiver.getCapabilities('video').codecs;
    let vp9_codecs = [];
    // iterate over supported codecs and pull out the codecs we want
    for(let i = 0; i < codecs.length; i++){
        if(codecs[i].mimeType == preferedCodec){
            vp9_codecs.push(codecs[i]);
        }
    }

    if(tcvr.setCodecPreferences != undefined && isChecked){
        tcvr.setCodecPreferences(vp9_codecs);
    }

}