var request = require('request');

module.exports = function(address, port)
{
    return {
        protocol: 'http',
        address: address,
        port: port,

        _getServerAddress: function(page){
            return this.protocol+'://'+this.address+':'+this.port+'/'+page;
        },

        getDevices: function(callback){
            request(this._getServerAddress('device'), function (error, response, body) {
                if(error){
                    console.log('Error:', error);
                    callback({});
                } else {
                    var JsonObject = JSON.parse(body);

                    callback(JsonObject.devices)
                }
            });
        },

        getDevice: function(liveid, callback){
            request(this._getServerAddress('device/'+liveid), function (error, response, body) {
                if(error){
                    console.log('Console with the suppliedd liveid was never found by the xbox-smartglass-rest server');
                    console.log('Error:', error);
                    callback({});
                } else {
                    var JsonObject = JSON.parse(body);

                    callback(JsonObject.device)
                }
            });
        },

        connect: function(liveid, callback){
            request(this._getServerAddress('device/'+liveid+'/connect'), function (error, response, body) {
                if(error){
                    console.log('Error:', error);
                    callback({});
                } else {
                    var JsonObject = JSON.parse(body);

                    callback(JsonObject.success)
                }
            });
        },

        powerOn: function(liveid, callback){
            request(this._getServerAddress('device/'+liveid+'/poweron'), function (error, response, body) {
                if(error){
                    console.log('Error:', error);
                    callback({});
                } else {
                    var JsonObject = JSON.parse(body);

                    callback(JsonObject.success)
                }
            });
        },

        powerOff: function(liveid, callback){
            request(this._getServerAddress('device/'+liveid+'/poweroff'), function (error, response, body) {
                if(error){
                    console.log('Error:', error);
                    callback({});
                } else {
                    var JsonObject = JSON.parse(body);

                    callback(JsonObject.success)
                }
            });
        },

        sendInput: function(liveid, button, callback){
            request(this._getServerAddress('device/'+liveid+'/input/'+button), function (error, response, body) {
                if(error){
                    console.log('Error:', error);
                    callback({});
                } else {
                    var JsonObject = JSON.parse(body);

                    callback(JsonObject.success)
                }
            });
        },

        sendMedia: function(liveid, button, callback){
            request(this._getServerAddress('device/'+liveid+'/media/'+button), function (error, response, body) {
                if(error){
                    console.log('Error:', error);
                    callback({});
                } else {
                    var JsonObject = JSON.parse(body);

                    callback(JsonObject.success)
                }
            });
        },

        sendIr: function(liveid, button, callback){
            request(this._getServerAddress('device/'+liveid+'/ir/'+button), function (error, response, body) {
                if(error){
                    console.log('Error:', error);
                    callback({});
                } else {
                    if(response.statusCode == 200){
                        var JsonObject = JSON.parse(body);
                        callback(JsonObject.success)
                    } else {
                        callback(false)
                    }
                }
            });
        }
    }
}
