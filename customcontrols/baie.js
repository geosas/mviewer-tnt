mviewer.customControls.baie = (function () {
    /*
     * Private
     */
    var _parametre;
    var selection_station;
    var _xhrPost;
    var _xhrGet;
    var _xmlRequest;
    var _rqtWPS;
    var _urlWPS = "http://wps.geosas.fr/tnt?";
    var _extratctDem = "extractDEM";
    var _service = "WPS";
    var _version = "1.0.0";
    var _request = "Execute";
    var _identifierDismiss = "dismiss";
    var _identifierXY = "xyOnNetwork";
    var _intersection="getIntersection";
    var FitData ="fitData";
    var getStation="getStation";
    var postProject="createProject";
    var getUrlP="exportTNT";
    var postSol="updateSol";
    var getExutoire="getOutlet";
    var _uuid;
    var _storeExecuteResponse = true;
    var _lineage = true;
    var _status = true;
    var _refreshTime;
    var _timeOut;
    var _updating;
    var _countdown;
    var _nameColor = [];
    var _traces = [];
    var _layout;
    var _timeoutCount = 0;
    var _colors = ["red", "#8b4513", "#FF8C00", "#20B2AA", "purple"];
    var _processing = false;
    var _stationsSelectedByUser;
    var _timerCountdown;
    var _display;
    var selection1;
    var targetArea;
    var X;
    var Y;
    var boundingBox;
    var simulationName;
    var bv_json;
    var exutoireLayer;
    var cheptelLayer;
    var solLayer;
    var dfaLayer;
    var station_qualite;
    var data_cheptel;
    var cantonSelected;
    var rpg_info;
    var ocs_info;
    var date_min;
    var date_max;
    var _draw;
    var ucs;
    var dict_sol =  {};
    var data_sol;
    var resolution_user;
    
    
    
    function updateProcess(url, cb) {
        if (_processing) {
            //var start_time = new Date().getTime();
            _xhrGet = getXDomainRequest();
            _xhrGet.addEventListener("loadend", cb);
            // test pour ne pas reexucter la requete, car le clearinterval possede un
            // un envoie de trop en cas d'un ralentissement du navigateur
            _xhrGet.open("GET", ajaxURL(url), true);
            // indique un timeout pour empecher les requetes
            // de s'executer indefiniment dans le cas ou le navigateur
            // passe des requetes en cache.
            _xhrGet.timeout = _timeOut;
            // si trop de timeout, arrete l'actualisation
            _xhrGet.ontimeout = function () {
                _timeoutCount += 1;
                if (_timeoutCount === 1) {
                    clearInterval(_updating);
                    clearInterval(_countdown);
                    $("#countdown")[0].textContent = "00:00";
                    // translate
                    if (mviewer.lang.lang == "en") {
                        processingBarUpdate(0, "The server is not responding, restart the treatment");
                    } else {
                        processingBarUpdate(0, "Le serveur ne répond pas, relancez le traitement");
                    }
                    _timeoutCount = 0;
                    _processing = false;
                }
            };

            _xhrGet.addEventListener('readystatechange', function () {
                if (_xhrGet.readyState === XMLHttpRequest.DONE && _xhrGet.status === 200) {
                    // Converti le xml en JSON pour pouvoir interagir avec les tags
                    // depuis n'importe quel navigateur (EDGE ne comprend pas les tags wps: et autres)
                    // tres important de le faire et ça evite de faire des getElements...)
                    var response = $.xml2json(_xhrGet.responseXML);
                    // recupere et met a jour le status du traitement
                    getAndSetStatus(response);
                    //var request_time = new Date().getTime() - start_time;
                    //console.log("La requete a pris : " + request_time);
                    if (!(response.Status.ProcessAccepted) && !(response.Status.ProcessStarted)) {
                        // arrete l'ecoute du status puisque le process est termine
                        clearInterval(_updating);
                        if (response.Status.ProcessSucceeded) {
                            // Hide kill process button
                            $("#dismiss").toggleClass("hidden");
                            // le comptage n'est pas le meme s'il y a plusieurs outputs
                            var outputsTags = Object.keys(response.ProcessOutputs).map(function (itm) {
                                return response.ProcessOutputs[itm];
                            });
                            var iteration;
                            if (outputsTags[0].length > 1) {
                                iteration = outputsTags[0].length;
                            } else {
                                iteration = outputsTags.length;
                            }

                            for (var i = 0; i < iteration; i++) {
                                var outputTag;
                                if (iteration === 1) {
                                    outputTag = outputsTags[0];
                                } else {
                                    outputTag = outputsTags[0][i];
                                }

                                if (outputTag.Identifier === "dismiss") {
                                  // Hide kill process button
                                  $("#dismiss").toggleClass("hidden");
                                  _processing = false;

                                } else if (outputTag.Identifier === "exutoires") {
                                    catchExutoire();
                                    _processing = false;
                                }
                            }
                        }
                    }
                }
            });
            _xhrGet.send();

        } else {
            clearInterval(_updating);
            clearInterval(_countdown);
            // translate
            if (mviewer.lang.lang == "en") {
                console.log("End of treatment");
            } else {
                console.log("Fin du traitement");
            }
            $("#countdown")[0].textContent = "00:00";
            _processing = false;
        }
    }




    return {
        /*
         * Public
         */

        init: function () {
            // mandatory - code executed when panel is opened
            $(".list-group-item.mv-layer-details.draggable[data-layerid='baie'] .row.layerdisplay-legend").hide();
            $(".mv-layer-options[data-layerid='baie'] .form-group-opacity").hide();
            $(".mv-nav-item[data-layerid='fluxExu'] ").click();

          },

        dismiss: function() {
            // dismiss button disappear
            $("#dismiss").toggleClass("hidden");

            // list of inputs
            var dictInputs = {
                uuid: _uuid
            };

            // Build wps request
            _rqtWPS = buildPostRequest(dictInputs, _identifierDismiss);

            // set time processing
            _refreshTime = 1000;
            _timeOut = 10000;

            // Execute process
            // var _processing already set true
            // Stop process refresh
            _xhrGet.abort();
            clearInterval(_updating);
            clearInterval(_countdown);
            processExecution();
        },

        catchExutoire: function(vectorLayer) {
            selection1 = new ol.Collection();
            selection_station = new ol.interaction.Select({
                layers:[vectorLayer],
                features:selection1
            });
    
            _map.addInteraction(selection_station)
            var displayFeatureInfoDFA = function(pixel) {
    
                var feature = _map.forEachFeatureAtPixel(pixel, function(feature) {
                    return feature;
                });
    
                if (feature) {
    
                    
                    var coordExu=feature.getGeometry().getCoordinates()
                    coordExu=ol.proj.transform([coordExu[0],coordExu[1]], 'EPSG:3857', 'EPSG:2154')   
                    console.log(coordExu)
                }                
            }
                        
            var evtKey=_map.on('click', function(evt) {
                    if (evt.dragging) {
                        return;
                    }
                    var pixel = _map.getEventPixel(evt.originalEvent);
                    displayFeatureInfoDFA(pixel);
                });
        },

        selectExu: function (){
            _stationsSelectedByUser= (selection1.getArray().map(function(feature) {

                return feature.getGeometry().getCoordinates().toString()

            }));
            console.log(_stationsSelectedByUser)

        },

        

        destroy: function () {
           // mandatory - code executed when layer panel is closed
       }


    };
}());
