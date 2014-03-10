// Include the json parse/stringify library. We host it here if you want to use it:
// !ref: http://meshmoon.data.s3.amazonaws.com/app/lib/json2.js, Script

// Include our utils script that has asset storage and bytearray utils etc.
// !ref: http://meshmoon.data.s3.amazonaws.com/app/lib/admino-utils-common-deploy.js, Script
// !ref: http://meshmoon.data.s3.amazonaws.com/app/lib/class.js, Script
engine.ImportExtension('qt.core');
engine.IncludeFile("http://meshmoon.data.s3.amazonaws.com/app/lib/class.js");
engine.IncludeFile("http://meshmoon.data.s3.amazonaws.com/app/lib/admino-utils-common-deploy.js");
SetLogChannelName("Police script"); //this can be anything, but best is your application name
Log("Script starting");

//Variable where we store the obj data.
var frametimma;
var pathWays;
var nextDest;
var curDest;
var playerToBeBusted;
var transfer = asset.RequestAsset("http://meshmoon.eu.scenes.2.s3.amazonaws.com/mediateam-b4527d/test2/navmesh/kartta.obj", "Binary", true);
transfer.Succeeded.connect(function(transfer) {
    pathWays = parseObjData(transfer);
    if (this.me.placeable.Position().y < 9) {
        var tm = this.me.placeable.transform;
        tm.pos.y = 0;
        tm.pos.x = 9;
        tm.pos.z = 0;
        this.me.placeable.transform = tm;
    }
});

//Boolean variable to check if police or entity has reached goal (global... i know).
var reachedGoal = true;
frame.Updated.connect(Update);

function Update (frametime) {
    if (server.IsRunning()) {
        bustPlayers();
        //if(pathWays)
            //newDestination(pathWays, frametime);
    }
    
}

//police movement script. If you want to edit the movement change line 55 for the space in which the bot
//  can move. Now its from 15m to 20m distance. Also you can change speed of the police man by changing var speed.
function newDestination(destination, frametime) {
    //If bot reached its goal, random a new goal and check that its valid.
    if (reachedGoal) {
        var nextDesti = destination[random(destination.length)];
        xNow = nextDesti[0];
        zNow = nextDesti[1];
        var dist = Math.sqrt(Math.pow((xNow - this.me.placeable.Position().x), 2) + 
            Math.pow((zNow - this.me.placeable.Position().z), 2));
            
        if (dist < 20  && dist > 15 && nextDest != nextDesti) {
            Log (nextDest + " --- " + nextDesti);
            nextDest = nextDesti;
        } else 
            return;
    }

    var totalLat=0;
    var totalLon=0;
    var ratioLat;
    var ratioLon; 
    var tm = this.me.placeable.transform;

    //Make relative values for walking.
    var relativeLon = nextDest[0] - this.me.placeable.Position().x;
    var relativeLat = nextDest[1] - this.me.placeable.Position().z;

    //Check ratio to walk
    if (Math.abs(relativeLat) >= Math.abs(relativeLon)) {
        ratioLon = Math.abs(relativeLon / relativeLat);
        ratioLat = 1;
    } else {
        ratioLat = Math.abs(relativeLat / relativeLon);
        ratioLon = 1;
    }


    //Moving the police.
    var time = frametime;
    var speed = 2.0; //Can be adjusted to a different value later.
    //Wher are we now.
    var yNow = this.me.placeable.Position().y;
    var xNow = this.me.placeable.Position().x;
    var zNow = this.me.placeable.Position().z;

    //Movement.
    var lats = speed * time * ratioLat;
    var lons = speed * time * ratioLon;

    //Check in which quarter we are moving into.
    if (relativeLon >= 0) var finalMovementX = xNow + lons;
    else var finalMovementX = xNow - lons;

    if (relativeLat >= 0) var finalMovementZ = zNow + lats;
    else var finalMovementZ = zNow - lats;

    //Add movement value to total position value.
    totalLat += lats;
    totalLon += lons;
    tm.pos.x = finalMovementX;
    tm.pos.z = finalMovementZ;

    //Assign value to script owner - Police bot
    this.me.placeable.transform = tm;

    //Check if we have reached goal and assign value to global parameter, so we can monitor 
    //  easily the functionality.
    if (totalLat > Math.abs(relativeLat) || totalLon > Math.abs(relativeLon)) {
        reachedGoal = true;
        totalLat = 0;
        totalLon = 0;
    } else
        reachedGoal = false;
}



function parseObjData(data) {
    //Variables for the function to handle data from server.
    var objText = data.RawData();
    var verticles;
    var obj = {};
    var graph;
    var vertexMatches = QByteArrayToString(objText).match(/^v( -?\d+(\.\d+)?){3}$/gm);
    var result;
    var values = String(vertexMatches).split(",");
    var xNz = [];

    for (i = 0; i < values.length; i++) {
        values[i] = String(values[i]).replace('v ', '');
    }

    for (i = 0; i < values.length; i++) {        
        values[i] = String(values[i]).split(" ");
    }
    if (values) {
        obj = values.map(function(vertex)
    {   
            vertex.splice(1, 1);
            values = vertex; 
            xNz.push(values);
        });
        
    }
    return xNz; 
}

//Function for bot to bust players that are spraying and within 30m. If you want to change the distance needed to bust
//  change 30 on line 164.
function bustPlayers() {

    var Players = scene.EntitiesOfGroup('Player');

    for (var i in Players) {
        var json = null;
        var x = this.me.placeable.Position().x;
        var z = this.me.placeable.Position().z;
        //Calculating logic for distance.
        var distance = Math.sqrt(Math.pow((x - Players[i].placeable.Position().x), 2) + 
                Math.pow((z - Players[i].placeable.Position().z), 2));
        //distance has to be correlated to the desired value for police to bust player from (30m default)
        if (Players[i].dynamiccomponent.GetAttribute('spraying')) {
                //Get data from server, and change it so that the player is busted via police now.
                if (distance < 30) {
                    playerToBeBusted = Players[i];
                    var transfer = asset.RequestAsset("http://vm0063.virtues.fi/gangsters/","Binary", true);
                    transfer.Succeeded.connect(bustAndUpload);
                } else
                    continue; 
        }
    }
}

function bustAndUpload(players) {

    if (players.RawData() == [] || players.RawData() == "")
        return;

    var playersToString = QByteArrayToString(players.RawData());
    var json = JSON.parse(playersToString);
    for (var i in json) {
        if (json[i].username == playerToBeBusted.name) {
                var player = json[i];
        }
    }

    if (player) {
        player.bustedviapolice = 1;
        player.points -= 30;
        player.busts += 1;
        var json = JSON.stringify(player);
        var qByteJson = EncodeString('UTF-8', json);
        playerToBeBusted.dynamiccomponent.SetAttribute('spraying', false);
        var storageURL = "http://vm0063.virtues.fi/";
        var storageName = "busting";

        var myStorage = asset.DeserializeAssetStorageFromString("name=" + storageName + ";src=" + storageURL
            + ";type=HttpAssetStorage;", false);
        var uploadPath = "gangsters";
        var uploadTransfer = asset.UploadAssetFromFileInMemory(qByteJson, storageName, uploadPath);
        uploadTransfer.Completed.connect(this, function(transfer){
            Log("Completed " + transfer.AssetRef());

        });

        uploadTransfer.Failed.connect(this, function(transfer){
            Log("UploadTransfer failed " + transfer.AssetRef());
        });
    
    }
}

function QByteArrayToString(qbytearray)
{
    var ts = new QTextStream(qbytearray, QIODevice.ReadOnly);
    return ts.readAll();
}

function DecodeString(encoding, qbytearray)
{
    var strEncoding = new QByteArray(encoding);
    var codec = QTextCodec.codecForName(strEncoding);
    return codec.toUnicode(qbytearray);
}

function EncodeString(encoding, string)
{
    var strEncoding = new QByteArray(encoding);
    var codec = QTextCodec.codecForName(strEncoding);
    return codec.fromUnicode(string);
}

function random(n) {
    seed = new Date().getTime();
    seed = (seed*9301+49297) % 233280;
    
    return (Math.floor((seed/(233280.0)* n)));
}