let WebSocketServer = require('ws').Server;
const https = require('https');
const fs = require('fs');

const options = {
    key: fs.readFileSync('key.pem'),
    cert: fs.readFileSync('cert.pem')
  };

  const index = fs.readFileSync('./index.html');
  const mainJs = fs.readFileSync('./main.js');

  let server = https.createServer(options, (req, res) => {
    if (req.url == "/main.js"){
        res.writeHead(200);
        res.end(mainJs);
        return;
    }
    res.writeHead(200);
    res.end(index);
  });

  server.listen(443);
  let ws = new WebSocketServer({server});
room = {
    host : null,
    clients: {}
};

ws.once('listening', () => {
    console.log("Started 443");
})

ws.on('connection', (con) => {

    console.log("User connected");
    let conMsg = {
        subtype: "peers",
        peers: Object.keys(room.clients)
    };
    con.send(JSON.stringify(conMsg));

    con.on('message', (msg) => {

        console.log("mensaje del usuerio")
        mensaje = msg.toString();
        tratarMensaje(mensaje, con);
    })
})


function tratarMensaje(msg, con){

    parsed = JSON.parse(msg.toString());

    switch(parsed.type){

        case 0: 
            if (parsed.host){
                room.host = parsed.name;
                con.name = parsed.name;
                room.clients[parsed.name] = con;
    

            } else {
                console.log("client "+ parsed.name);
                con.name = parsed.name;
                room.clients[parsed.name] = con
            }
        break;

        case 1:

            for (let k in room.clients){
                if (k == parsed.name)
                    continue;
                room.clients[k].send(JSON.stringify(parsed))
            }

        break;

    }      

    con.once("close", () => {
        console.log("disconnected");
        room.clients[con.name] = null;
        delete room.clients[con.name];
    })  
}