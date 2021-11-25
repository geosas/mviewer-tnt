mviewer.customControls.fluxExu = (function () {
    /*
     * Private
     */
    var selection_station;
    var _xhrPost;
    var _xhrGet;
    var _xmlRequest;
    var _rqtWPS;
    var _urlWPS = "http://psncalc.agrocampus-ouest.fr/tnt-test-wps?";
    var _extratctDem = "extractDEM";
    var _service = "WPS";
    var _version = "1.0.0";
    var _request = "Execute";
    var _identifierDismiss = "dismiss";
    var _identifierXY = "xyOnNetwork";
    var FitData ="fitData";
    var getStation="getStation";
    var getUrlP="exportTNT";
    var postSol="updateSol";
    var getExutoire="getOutlet";
    var _uuid;
    var _storeExecuteResponse = true;
    var _lineage = false;
    var _status = true;
    var _refreshTime;
    var _timeOut;
    var _updating;
    var _countdown;
    var _layout;
    var _timeoutCount = 0;
    var _processing = false;
    var _stationsSelectedByUser;
    var _timerCountdown;
    var _display;
    var selection1;
    var X;
    var Y;
    var boundingBox;
    var simulationName;
    var bv_json;
    var exutoireLayer;
    var cheptelLayer;
    var waterLayer
    var sbv_rotationLayer;
    var solLayer;
    var dfaLayer;
    var data_cheptel;
    var cantonSelected;
    var rpg_info;
    var _draw;
    var ucs;
    var dict_sol =  {};
    var data_sol;
    var resolution_user;
    var exutoire_statut = false
    var ocs_statut = true
    var cheptel_statut = true
    var dem
    var referentiel

    // Permet d'utiliser l'equivalent de .format{0} dans js (source :stack overflow)
    if (!String.format) {
        String.format = function (format) {
            var args = Array.prototype.slice.call(arguments, 1);
            return format.replace(/{(\d+)}/g, function (match, number) {
                return typeof args[number] != 'undefined' ?
                    args[number] :
                    match;
            });
        };
    }

    function insideProjectArea(X, Y) {
        // si le point cliqué est dans la zone du projet, permet son execution
        if (X < 120000 || X > 417000 || Y < 6658714 || Y > 6902794) {
            return false;
        } else {
            return true;
        }
    }

    // Cree la variable xmlrequest
    function getXDomainRequest() {
        var xhr = null;
        // sous internet explorer
        if (window.XDomainRequest) {
            xhr = new XDomainRequest();
            // autres navigateurs
        } else if (window.XMLHttpRequest) {
            xhr = new XMLHttpRequest();
        } else {
            // translate
            if (mviewer.lang.lang == "en") {
                alert("Error initialisation XMLHttpRequests");
            } else {
                alert("Erreur initialisation XMLHttpRequests");
            }
        }
        return xhr;
    }

    // Permet de gerer les requetes cross-domain
    function ajaxURL(url) {
        if (url.indexOf('http') !== 0) {
            return url;
        } else if (location.host=='localhost'){
            return url;
        } // same domain
        else if (url.indexOf(location.protocol + '//' + location.host) === 0) {
            return url;
        } else {
            return '/proxy/?url=' + encodeURIComponent(url);
        }
    }

    function buildPostRequest(dictInputs, identifier) {
        // Cree la requete POST du process
        _xmlRequest = String.format(['<?xml version="1.0" encoding="UTF-8"?>',
            '<wps:{0} xmlns:ows="http://www.opengis.net/ows/1.1" xmlns:wps="http://www.opengis.net/wps/1.0.0" ',
            'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" version="{1}" service="{2}" ',
            'xsi:schemaLocation="http://www.opengis.net/wps/1.0.0 http://schemas.opengis.net/wps/1.0.0/wpsAll.xsd">',
            '<ows:Identifier>{3}</ows:Identifier><wps:DataInputs>'
        ].join(""), _request, _version, _service, identifier);

        // split le dictionnaire contenant les parametres et valeurs
        var dataIdentifiers = Object.keys(dictInputs);
        var dataInputs = Object.keys(dictInputs).map(function (itm) {
            return dictInputs[itm];
        });

        // genere la partie du xml contenant les parametres et valeurs
        for (var i = 0; i < dataIdentifiers.length; i++) {
            inputXml = String.format(['<wps:Input><ows:Identifier>{0}</ows:Identifier>',
                '<wps:Data><wps:LiteralData>{1}</wps:LiteralData></wps:Data></wps:Input>'
            ].join(""), dataIdentifiers[i], dataInputs[i]);
            _xmlRequest += inputXml;
        }

        // termine la generation du document pour une execution asynchrone et contenant le statut et les parametres en entree
        _xmlRequest += String.format(['</wps:DataInputs><wps:ResponseForm><wps:ResponseDocument ',
            'storeExecuteResponse="{0}" lineage="{1}" status="{2}"></wps:ResponseDocument>',
            '</wps:ResponseForm></wps:{3}>'
        ].join(""), _storeExecuteResponse, _lineage, _status, _request);

        return _xmlRequest;
    }

    function processingBarUpdate(percent, message) {
        // Fonction pour mettre a jour la barre de progression selon les valeurs du wps
        if (percent === 100) {
            // si le traitement est termine, supprime l'animation (via la valeur 0), et met le fond en bleu
            percent = 0;
            $("#processingBar").css("backgroundColor", "#2e5367");
        } else {
            $("#processingBar").css("backgroundColor", "#808080");
        }
        if (percent == 39) {
            plotMNT(message,'_altitude');
            $("#progression").css("width", percent + "%");
            $("#progression").attr("aria-valuenow", percent);
            $("#processing-text").text("MNT généré");
        } else {
            $("#progression").css("width", percent + "%");
            $("#progression").attr("aria-valuenow", percent);
            $("#processing-text").text(message);
        }
    }

    function getAndSetStatus(response) {
        // Met a jour le texte dans la barre de progression selon le document de reponse du wps
        // et arrete l'actualisation du process s'il est termine ou failed
        if (response.Status.ProcessAccepted) {
            // translate
            if (mviewer.lang.lang == "en") {
                processingBarUpdate(5, "Waiting queue : please wait");
            } else {
                processingBarUpdate(5, "File d'attente : veuillez patienter");
            }

        } else if (response.Status.ProcessStarted) {
            if ($("#countdown")[0].textContent == "00:00"){
                startTimer(_timerCountdown, _display);
            }

            if (response.Status.ProcessStarted == "Impossible de DL les datas"){
                // translate
                if (mviewer.lang.lang == "en") {
                    processingBarUpdate(100, "Hub-Eau don't respond");
                    alert("Impossible to DL data at Hub-Eau");
                } else {
                    processingBarUpdate(100, "Hub-Eau ne répond pas");
                    alert("Impossible de télécharger les données sur Hub-Eau");
                }
                clearInterval(_updating);
                clearInterval(_countdown);
                $("#dismiss").toggleClass("hidden");
                $("#countdown")[0].textContent = "00:00";
                _processing = false;
            }
            else if (response.Status.ProcessStarted == "Pas de donnees pour ce parametre a cette localisation"){
                // translate
                if (mviewer.lang.lang == "en") {
                    processingBarUpdate(100, "No data here for NO3 ");
                    alert("Change station no data for NO3 here ");
                } else {
                    processingBarUpdate(100, "Pas de donnée ici pour NO3");
                    alert("Changer de station pas de données de NO3 à cette localisation");
                }
                clearInterval(_updating);
                clearInterval(_countdown);
                $("#dismiss").toggleClass("hidden");
                $("#countdown")[0].textContent = "00:00";
                _processing = false;
            }
             else {
                var percent = response.Status.ProcessStarted.percentCompleted;
                processingBarUpdate(percent, response.Status.ProcessStarted);
            }

        } else if (response.Status.ProcessSucceeded) {
            // translate
            if (mviewer.lang.lang == "en") {
                processingBarUpdate(100, "Finished");
            } else {
                processingBarUpdate(100, "Terminé");
            }
            clearInterval(_countdown);
            $("#countdown")[0].textContent = "00:00";

        } else if (response.Status.ProcessFailed) {
            _processing = false
            // Arrête la requete response.Status.ProcessFailed
            processingBarUpdate(0,response.Status.ProcessFailed.ExceptionReport.Exception.ExceptionText );
            clearInterval(_updating);
            clearInterval(_countdown);
            $("#countdown")[0].textContent = "00:00";
            Swal.fire({
              icon: 'error',
              title: 'Erreur',
              text: "Une erreur c'est produite, si elle persiste veuillez nous contacter et nous communiquer les informations ci-dessous",
              footer:_uuid+'Station : '+_stationsSelectedByUser+'  Date : '+new Date().toLocaleString(),

            })

        } else {
            // translate
            if (mviewer.lang.lang == "en") {
                processingBarUpdate(0, "Error, refresh the page");
            } else {
                processingBarUpdate(0, "Erreur, actualisez la page");
            }
            clearInterval(_updating);
            clearInterval(_countdown);
            $("#countdown")[0].textContent = "00:00";
        }
    }

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

                                } else if (outputTag.Identifier === "XY") {
                                    _xy = outputTag.Data.LiteralData.split(" ");
                                    if (Number(_xy[0]) == 0 && Number(_xy[1]) == 0) {
                                        Swal.fire({
                                            icon: 'error',
                                            title: 'Erreur',
                                            text: "Le seuil des sous-bassins versant est trop faible, augmenter sa valuer\n ou \n\
La coordonnée indiquée possède une altitude inférieure à 0, aucune simulation possible. Veuillez indiquer un point plus en amont",
                                        });
                                    } else {
                                        mviewer.showLocation('EPSG:2154', Number(_xy[0]), Number(_xy[1]));
                                        X=_xy[0]
                                        Y=_xy[1]
                                    }
                                    _processing = false;

                                } else if (outputTag.Identifier === "TargetWatershed") {
                                    plotGeojson(outputTag.Data.ComplexData,"bv");
                                    _processing = false;

                                } else if (outputTag.Identifier === "url") {
                                    if (outputTag.Data.LiteralData=='projectNotNone'){
                                        alert("Projet déjà existant, changer le nom. Si c'est votre projet, le nom d'utilisateur ne correspond pas")
                                    } else if (outputTag.Data.LiteralData == 'mntfailed') {
                                        alert("L'extraction du MNT a échoué")
                                    }
                                    _processing = false;
                                    $("#bottom-panel").toggleClass("active");
                                    Swal.fire({
                                        icon: 'success',
                                        text: "Extraction des données réussie, paramètrage à effectuer",
                                    }); // afficher une couche station ?
                                } else if (outputTag.Identifier === "carte_sol") {
                                    if (outputTag.Data.ComplexData.length === undefined) {}
                                    else {
                                        plotGeojson(outputTag.Data.ComplexData,"sol");
                                    }
                                    _processing = false;
                                }else if (outputTag.Identifier === "icpe") {
                                    plotGeojson(outputTag.Data.ComplexData,"icpe");
                                    _processing = false;
                                } else if (outputTag.Identifier === "dfa_cheptel") {
                                    if (outputTag.Data.ComplexData.length === undefined) {}
                                    else {
                                        plotGeojson(outputTag.Data.ComplexData,"cheptel");
                                    }
                                    _processing = false;
                                } else if (outputTag.Identifier === "dfa_fit") {
                                    //$("#bottom-panel").toggleClass("active");
                                        Swal.fire({
                                            icon: 'success',
                                            text: "Les DFA ont été ajoutées au référentiel",
                                        });
                                        $("#btn_dfa").css("background-color","var(--mycolor)");
                                        $("#btn_dfa").css("color","white");
                                        if ($("#legendwms").children().first()) {
                                            $("#legendwms").remove();
                                            deleteLayers(["mntWms"]);
                                        }
                                        sbv_ocsLayer.setVisible(false)
                                        cheptelLayer.setVisible(false)
                                    plotGeojson(outputTag.Data.ComplexData,"dfa_fit");
                                    if ($("#divPopup1").children().first()) {
                                        $("#divPopup1").empty();
                                        if ($("#graphFlowSimulated").children().first()) {
                                            $("#graphFlowSimulated").children().first().remove();
                                            $("#graphFlowSimulatedExtend").children().first().remove();
                                        }
                                    }
                                    $("#divPopup1").append("<div>Veuillez sélectionner sur la carte les sbv pour afficher les DFA générés</div>")
                                    _processing = false;
                                } else if (outputTag.Identifier === "sbv_rotation") {
                                    if (outputTag.Data.ComplexData.length === undefined) {}
                                    else {
                                        plotGeojson(outputTag.Data.ComplexData,"sbv_rotation");
                                    }
                                    _processing = false;
                                } else if (outputTag.Identifier === "station_qualite") {
                                    if ((outputTag.Data.ComplexData[0]==='f')){
                                        alert("Il n'y a pas de station dans la zone.\nVeuillez changer de bassin versant.\n \
                                        Il est possible de continuer sans station (pas pour l'instant")
                                    } else {
                                        plotGeojsonQualite(JSON.parse(outputTag.Data.ComplexData));
                                    }
                                    _processing = false;
                                } else if (outputTag.Identifier === "sbv_ocs") {
                                    if (outputTag.Data.ComplexData.length === undefined) {}
                                    else {
                                        plotGeojson(outputTag.Data.ComplexData,"sbv_ocs");
                                    }
                                    _processing = false;
                                } else if (outputTag.Identifier === "rpg_info") {
                                    if (outputTag.Data.ComplexData.length === undefined) {}
                                    else {
                                        rpg_info=JSON.parse(outputTag.Data.ComplexData);
                                    }
                                    _processing = false;
                                } else if (outputTag.Identifier === "ocs_info") {
                                    if (outputTag.Data.ComplexData.length === undefined) {}
                                    else {
                                        ocs_info=JSON.parse(outputTag.Data.ComplexData);
                                    }
                                    _processing = false;
                                } else if (outputTag.Identifier === "statut"){
                                    if (outputTag.Data.LiteralData=='ok_sol'){
                                        $("#bottom-panel").toggleClass("active");
                                        Swal.fire({
                                            icon: 'success',
                                            text: "Les caractéristiques du sol ont été ajoutées au référentiel",
                                        });
                                        solLayer.setVisible(false)
                                        $("#btn_sol").css("background-color","var(--mycolor)");
                                        $("#btn_sol").css("color","white");
                                    }
                                    if (outputTag.Data.LiteralData=='ok_rpg'){
                                        $('#rpgInput').collapse('hide')
                                        $('#dateOptions').collapse('hide')
                                        $('#annexe').collapse('show')
                                    }
                                    _processing = false;

                                } else if (outputTag.Identifier === "exutoires") {
                                    plotGeojson(outputTag.Data.ComplexData,"exutoires");
                                    _processing = false;
                                    taille=$("#seuil_bv").val()
                                    if (taille!=undefined){
                                        mviewer.customControls.baie.catchExutoire(exutoireLayer)
                                        console.log('mode baie')
                                    }
                                } else if (outputTag.Identifier === "Download_URL"){
                                    alert(outputTag.Data.LiteralData)
                                    $("#divPopup1").append([
                                        "<b style='padding-top:60px;font-size:20px' >Lien de téléchargement : </b>",
                                        "<br><a href="+outputTag.Data.LiteralData+">"+outputTag.Data.LiteralData+ "</a>",
                                        "<br><b style='padding-top:60px;font-size:20px' >Lien WMS : </b>",
                                        "<br>http://psncalc.agrocampus-ouest.fr/tntserver/"+simulationName+"/wms"].join(""));
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



    function processExecution() {
        _xhrPost = getXDomainRequest();
        _xhrPost.open("POST", ajaxURL(_urlWPS), true);
        _xhrPost.timeout = _timeOut;
        _xhrPost.addEventListener('readystatechange', function () {
            if (_xhrPost.readyState === XMLHttpRequest.DONE && _xhrPost.status === 200) {
                // Recupere le xml de la reponse
                var response = $.xml2json(_xhrPost.responseXML);
                // Recupere l'url de la variable statusLocation
                var statusLocationURL = response.statusLocation;
                // Get UUID of process
                _uuid = statusLocationURL.split("/")[statusLocationURL.split("/").length-1].split(".")[0];
                // Maj de la barre de progression
                if (mviewer.lang.lang == "en") {processingBarUpdate(0, "Launching the query");}
                else{processingBarUpdate(0, "Lancement de la requête");}


                var promise = Promise.resolve(true);
                // Debut d'ecoute du resultat
                _updating = setInterval(function () {
                    // permet de gerer l'attente avant de relancer une requete
                    // par contre, dans le cas d'un ralentissement, une requete est
                    // envoyee, d'ou le if dans updateProcess
                    promise = promise.then(function () {
                        return new Promise(function (resolve) {
                            updateProcess(statusLocationURL, resolve);
                        });
                    });
                }, _refreshTime);
            }
        });
        _xhrPost.send(_rqtWPS);
    }

    function deleteLayers(layers){
        // suppression des layers
        var layersToRemove = [];
        _map.getLayers().forEach(function (layer) {
            for (var i = 0; i < layers.length; i++) {
                if (layer.get('name') != undefined && layer.get('name') === layers[i]) {
                    layersToRemove.push(layer);
                }
            }
        });
        var len = layersToRemove.length;
        for (var i = 0; i < len; i++) {
            _map.removeLayer(layersToRemove[i]);
        }
    }

    function plotMNT(wms,couche) {

        mnt= new ol.layer.Tile({
            name : "mntWms",
            source: new ol.source.TileWMS({
            url: wms,
            params: {'LAYERS': simulationName+couche, 'TILED': true},
            serverType: 'geoserver'
          })
        })
        _map.getLayers().insertAt(4,mnt);


        urlLegend='http://psncalc.agrocampus-ouest.fr/tntserver/'+simulationName+'/ows?service=WMS&request=GetLegendGraphic&format=image%2Fpng&width=20&height=20&layer='+simulationName+couche


        //var img = document.getElementById('legend')
        $('#menu').append('<div id="legendwms" style="text-align: center;"><img src='+urlLegend+'></div>');

    }

    function plotFlowandNutriment(datas,station_name) {

      //plot le débit, la concentration et le flux à l'emplacement d'une station

        let trace1={
            name:"No3- mg/l",
            x:[],
            y:[],
            mode:"markers",
            yaxis: 'y',
            type: "scattergl",
            marker:{size:5,color:'black'},

        };

        datas.data.forEach(function(val) {
            trace1.x.push(val.date_prelevement);
            trace1.y.push(val.resultat);
        });
        _layout = {
            xaxis: {
                //title: 'Date',
                domain: [0, 0.85]
            },
            yaxis: {
                title: "No3- mg/l",
                titlefont:{color:"black"},
                tickfont: {color: 'black'},
                side: 'right',
                overlaying: 'y',
                rangemode: 'tozero'
            },
            showlegend: false,
            title: `Station: ${station_name}, ${datas.data.length}\n enregistrements de: ${datas.data[0].date_prelevement} à ${datas.data[datas.data.length - 1].date_prelevement}`,
            font: {
                family: "'Poppins', sans-serif"
            },
            margin: {
                l: 40,
                r: 20,
                b: 40,
                t: 50
            }

        };

        // utilisation de newplot car plot et addtraces dupliquent la legende
        // sur le second graphique
        Plotly.newPlot($("#graphFlowSimulated")[0], [trace1], _layout, {
            responsive: false,
            modeBarButtonsToRemove: ["toggleSpikelines", "zoomIn2d", "zoomOut2d"],
            scrollZoom: true
        });

        // duplication des graphiques et utilisation de la classe hidden (visibility) car
        // plotly.relayout pose soucis, impossible de depasser 450px de height et impossible
        // de revenir a l'etat d'avant
        Plotly.newPlot($("#graphFlowSimulatedExtend")[0], [trace1], _layout, {
            responsive: false,
            modeBarButtonsToRemove: ["toggleSpikelines", "zoomIn2d", "zoomOut2d"],
            scrollZoom: true
        });
    }
    function plotGeojsonQualite(datajson){
        vectorSource=new ol.source.Vector({
            features: new ol.format.GeoJSON().readFeatures(datajson,{
                dataProjection: 'EPSG:2154',
                featureProjection:'EPSG:3857' }),
        });
        qualiteLayer = new ol.layer.Vector({
            declutter: false,
            source: vectorSource,
            name: "qualiteLayer",
            style: function (feature) {
                if (feature.get('nb_rec_year') >= 12){col="#aacf6b"}
                else if (feature.get('nb_rec_year') < 12 && (feature.get('nb_rec_year') >= 6 )) {col="#eeb245"}
                else if (feature.get('nb_rec_year') < 6) {col="#e34b4b"}
                if (_map.getView().getZoom()<=11.5){
                    return new ol.style.Style({
                        image: new ol.style.RegularShape({
                            fill: new ol.style.Fill({color: col}),
                            stroke: new ol.style.Stroke({
                                color: 'white',
                                width: 1
                            }),
                            points: 3,
                            radius: 10,
                            angle: 0,
                        })
                    })
                } else{
                    return new ol.style.Style({
                        image: new ol.style.RegularShape({
                            fill: new ol.style.Fill({color: col}),
                            stroke: new ol.style.Stroke({
                                color: 'white',
                                width: 1
                            }),
                            points: 3,
                            radius: 10,
                            angle: 0,
                        }),
                        text:new ol.style.Text({
                            font: '12px Poppins,sans-serif',
                            text: feature.get('date_min')+'\n'+feature.get('date_max')
                            +'\n'+feature.get('nb_rec'),
                            offsetY: 40,
                            padding: [0.1, 0.1, 0.1, 0.1],
                            fill: new ol.style.Fill({ color: '#000' }),
                            stroke: new ol.style.Stroke({
                                color: '#fff',
                                width: 7
                            })
                        }),
                    })
                }
            }
        })

        _map.addLayer(qualiteLayer);

        key_gap=function () {};
        key_gap=show_info_multi(qualiteLayer);
        $('#menu').append('<div id="legendwms" style="text-align: center;"><img src="/apps/tnt-dev/data/legende_nb_rec.svg" alt="Légende nb_rec_year stations"></div>');
    }
    function plotGeojson(datajs,name){

        datajs= datajs.replace("<![CDATA[{", "");
        datajs= datajs.replace(" }]>", "");
        vectorSource=new ol.source.Vector({
            features: new ol.format.GeoJSON().readFeatures(datajs,{
                dataProjection: 'EPSG:2154',
                featureProjection:'EPSG:3857' }),
        });
        datajson=JSON.parse(datajs);

        if (name ==="sol"){
            solLayer = new ol.layer.Vector({
                source: vectorSource,
                name: "solLayer",
                style: function (feature) {
                    return new ol.style.Style({
                        stroke: new ol.style.Stroke({
                            width: 2,
                            color: "#1cb920"
                        }),
                        fill: new ol.style.Fill({
                            //color: "rgba(191, 181, 192, 0.1)",
                            color: feature.get('color')
                        }),
                        text:new ol.style.Text({
                            font: '12px Calibri,sans-serif',
                            text: feature.get('N_UCS').toString(),
                            fill: new ol.style.Fill({
                                color: "black"
                            }),
                            stroke: new ol.style.Stroke({
                                color: '#fff',
                                width: 5
                            })
                        }),
                    })
                }
            });
            _map.addLayer(solLayer);
            solLayer.setVisible(false)

            delete datajson.type;
            delete datajson.crs;
            datajson.features.forEach(function(val){
                delete val.geometry
            })
            data_sol=datajson;

        } else if (name ==="cheptel"){
            cheptelLayer = new ol.layer.Vector({
                source: vectorSource,
                name:"cheptelLayer",
                style: function (feature) {
                    return new ol.style.Style({
                        stroke: new ol.style.Stroke({
                            width: 2,
                            color: "#1cb920"
                        }),
                        fill: new ol.style.Fill({
                            color: "rgba(191, 181, 192, 0.1)",
                        }),
                        text:new ol.style.Text({
                            font: '12px Calibri,sans-serif',
                            text: feature.get('nom_geo'),
                            fill: new ol.style.Fill({
                                color: "black"
                            }),
                            stroke: new ol.style.Stroke({
                                color: '#fff',
                                width: 5
                            })
                        }),
                        overflow: true,
                        exceedLength: true
                    })
                }
            });
            _map.addLayer(cheptelLayer);
            cheptelLayer.setVisible(false);

            delete datajson.type;
            delete datajson.crs;
            datajson.features.forEach(function(val){
                delete val.geometry
            })
            data_cheptel=datajson;

        } else if (name ==="sbv_rotation"){

            sbv_rotationLayer = new ol.layer.Vector({
                source: vectorSource,
                name:"sbv_rotationLayer",
                style: function (feature) {
                    return new ol.style.Style({
                        stroke: new ol.style.Stroke({
                            width: 2,
                            color: "black"
                        }),
                        fill: new ol.style.Fill({
                            color: feature.get('color'),
                        }),
                        text:new ol.style.Text({
                            font: '12px Calibri,sans-serif',
                            text: feature.get('rota_melange_1')+" --> "+feature.get('rota_melange_1_pct')+"%"+
                                "\n"+feature.get('rota_melange_2')+" --> "+feature.get('rota_melange_2_pct')+"%"+
                                "\n"+feature.get('rota_melange_3')+" --> "+feature.get('rota_melange_3_pct')+"%"
                            ,
                            fill: new ol.style.Fill({
                                color: "black"
                            }),
                            stroke: new ol.style.Stroke({
                                color: '#fff',
                                width: 5
                            })
                        }),
                        overflow: true,
                        exceedLength: true
                    })
                }
            });
            _map.addLayer(sbv_rotationLayer);
            sbv_rotationLayer.setVisible(false);



        } else if (name ==="icpe"){
            var icpeLayer = new ol.layer.Vector({
                source: vectorSource,
                name: "icpeLayer"
            });
            _map.addLayer(icpeLayer);
            icpeLayer.setVisible(false);

        } else if (name ==="exutoires"){
            exutoire_statut=true
            exutoireLayer = new ol.layer.Vector({
                source: vectorSource,
                name: "exutoireLayer",
                style:  new ol.style.Style({
                    image: new ol.style.Circle({
                        fill: new ol.style.Fill({color: 'rgba( 211, 158, 16, 0.1)'}),
                        stroke: new ol.style.Stroke({color: 'black', width: 1.5}),
                        radius: 3,

                    })
                })
            });
            _map.addLayer(exutoireLayer);


        }
        else if (name ==="dfa_fit"){
            //deleteLayers(["cheptelLayer"])
            cheptelLayer.setVisible(false);
            deleteLayers(["dfaLayer"])

                dfaLayer = new ol.layer.Vector({
                source: vectorSource,
                name: "dfaLayer",
                style: function (feature) {
                    return new ol.style.Style({
                        stroke: new ol.style.Stroke({
                            width: 2,
                            color: "#1cb920"
                        }),
                        fill: new ol.style.Fill({
                            color: "rgba(191, 181, 192, 0.1)",
                        }),
                        text:new ol.style.Text({
                            font: '12px Calibri,sans-serif',
                            text: feature.get('nom_geo'),
                            fill: new ol.style.Fill({
                                color: "black"
                            }),
                            stroke: new ol.style.Stroke({
                                color: '#fff',
                                width: 5
                            })
                        }),
                            overflow: true,
                            exceedLength: true,
                        })
                    }
            });
            _map.addLayer(dfaLayer);
            delete datajson.type;
            delete datajson.crs;
            datajson.features.forEach(function(val){
                delete val.geometry
            })
            data_cheptel_fit=datajson;
            //key_gap=undefined




            key_gap=function (){};
            key_gap=show_info_multi(dfaLayer);
            $('#dfaAffine').collapse('hide')
        }
        else if (name ==="bv"){


            bv_json=new ol.source.Vector({
                features: new ol.format.GeoJSON().readFeatures(datajs)
            });

            boundingBox=bv_json.getExtent()
            bv_json=datajs

            deleteLayers(["waterLayer"])

            waterLayer = new ol.layer.Vector({
                source: vectorSource,
                name:"waterLayer",
                style: function (feature) {
                    return new ol.style.Style({
                        stroke: new ol.style.Stroke({
                            width: 3,
                            color: "black"
                        }),
                    });
                }
            });
            _map.addLayer(waterLayer);


        }
        else if (name ==="sbv_ocs"){
            sbv_ocsLayer = new ol.layer.Vector({
                source: vectorSource,
                name:"sbv_ocsLayer",
                style: function (feature) {
                    return new ol.style.Style({
                        stroke: new ol.style.Stroke({
                            width: 2,
                            color: "#a10010"
                        }),
                        fill: new ol.style.Fill({
                            color: "rgba(191, 181, 192, 0.05)",
                        }),
                        text:new ol.style.Text({
                            font: '12px Calibri,sans-serif',
                            text: "Culture été/hiver "+feature.get('culture été hiver')+" %"+
                            "\n"+"Forêt "+feature.get('forêt')+" %"+
                            "\n"+"Prairie "+feature.get('prairie')+" %"+
                            "\n"+"Urbain "+feature.get('urbain')+" %"+
                            "\n"+"Eau, autres "+feature.get('eau, autres')+" %",
                            fill: new ol.style.Fill({
                                color: "black"
                            }),
                            stroke: new ol.style.Stroke({
                                color: '#fff',
                                width: 5
                            })
                        }),
                        overflow: true,
                        exceedLength: true
                    })
                }
            });
            _map.addLayer(sbv_ocsLayer);
            sbv_ocsLayer.setVisible(false);



        }
    }

    function startTimer(duration, display) {
        var timer = duration,
            minutes, seconds;
        _countdown = setInterval(function () {
            minutes = parseInt(timer / 60, 10);
            seconds = parseInt(timer % 60, 10);

            minutes = minutes < 10 ? "0" + minutes : minutes;
            seconds = seconds < 10 ? "0" + seconds : seconds;

            display.textContent = minutes + ":" + seconds;

            if (--timer < 0) {
                // translate
                if (mviewer.lang.lang == "en") {
                    $("#countdown").text("Please wait...");
                } else {
                    $("#countdown").text("Veuillez patienter...");
                }
                clearInterval(_countdown);
            }
        }, 1000);
    }


    function show_info_multi(layerId){
        selection1 = new ol.Collection();
            selection_station = new ol.interaction.Select({
                layers:[layerId],
                features:selection1
            });

            _map.addInteraction(selection_station);
            var displayFeatureInfoDFA = function(pixel) {

                var feature = _map.forEachFeatureAtPixel(pixel, function(feature) {
                    return feature;
                });

                if (feature) {

                    if (feature.get('nom_geo') != undefined){
                        var name=feature.get('nom_geo')
                        var annee=["2015","2016","2017","2018","2019"]
                        var hist=[]



                        var x=['truies', 'porcs charcutiers',
                        'vaches_laitieres', 'nb vaches allaitantes', 'nb poules pondeuses',
                        'volailles reproductrices', 'nb dindes de chair',
                        'poulets de chair', 'autres volailles de chair']
                        var x2=['azote produit total', 'azote produit bovin',
                        'azote produit porcin', 'azote produit avicole', 'azote produit autres']

                        var x3=['N total épandu', 'N orga épandu','N orga non animal épandu', 'N min épandu']
                        if (layerId.get('name') == "dfaLayer"){
                            cheptel=data_cheptel_fit
                            sbv=true
                            var titre=feature.get('nom_geo')+ ', sbv: '+feature.get('bv')+', SAU: '+feature.get('sau_zone_inter_ha')
                        }
                        else {
                            cheptel=data_cheptel
                            sbv=false
                            var titre=feature.get('nom_geo')
                        }
                        for (i in annee ){
                            var y1=[]
                            var y2=[]
                            var y3=[]
                            cheptel.features.forEach(function(val){
                                if (sbv===true){
                                    if (feature.get('bv') != val.properties.bv){
                                        return // emulating JavaScript forEach continue statement
                                    }
                                }
                                if (val.properties.annee === annee[i] && val.properties.nom_geo ===name){
                                    y1.push(val.properties.nb_truies)
                                    y1.push(val.properties.nb_porcs_charcutiers)
                                    y1.push(val.properties.nb_vaches_laitieres)
                                    y1.push(val.properties.nb_vaches_allaitantes)
                                    y1.push(val.properties.nb_poules_pondeuses)
                                    y1.push(val.properties.nb_volailles_reproductrices)
                                    y1.push(val.properties.nb_dindes_de_chair)
                                    y1.push(val.properties.nb_poulets_de_chair)
                                    y1.push(val.properties.nb_autres_volailles_de_chair)

                                    y2.push(val.properties.azote_produit_total)
                                    y2.push(val.properties.azote_produit_bovin)
                                    y2.push(val.properties.azote_produit_porcin)
                                    y2.push(val.properties.azote_produit_avicole)
                                    y2.push(val.properties.azote_produit_autres)

                                    y3.push(val.properties.ntot)
                                    y3.push(val.properties.norgan)
                                    y3.push(val.properties.norgnan)
                                    y3.push(val.properties.nmin)
                                }
                            });

                            hist.push({
                                histfunc: "sum",
                                y: y1,
                                x: x,
                                type: "histogram",
                                name: annee[i],
                            });
                            hist.push({
                                histfunc: "sum",
                                y: y2,
                                x: x2,
                                type: "histogram",
                                xaxis: "x2",
                                yaxis: "y2",
                                name: annee[i],
                                showlegend: false,
                            });
                            hist.push({
                                histfunc: "sum",
                                y: y3,
                                x: x3,
                                type: "histogram",
                                xaxis: "x3",
                                yaxis: "y3",
                                name: annee[i],
                                showlegend: false
                            });
                        };

                        var layout = {
                            title:"Canton : "+titre,
                            font: {
                                family: "'Poppins', sans-serif"
                            },
                            grid: {rows: 1, columns: 3, pattern: 'independent'},
                        };
                        Plotly.newPlot($("#graphFlowSimulated")[0], hist, layout)
                        Plotly.newPlot($("#graphFlowSimulatedExtend")[0], hist, layout)

                    } else if (feature.get('rota_melange_1') != undefined) {

                        data=[]
                        annotations=[]
                        decal=-0.2
                        col_max=0

                        $.each(rpg_info, function(index, object) {
                            if (object.ogc_fid===feature.get('sbv')){
                                decal+=0.2
                                val=[]
                                col_name=[]
                                surf=""
                                parcelles=""

                                for (var property in object) {
                                    if (property==="annee"){
                                        nameY=object[property]
                                    } else if (property==="surface") {
                                        surf+=(property + " : "+ object[property]+" ha")
                                    } else if (property=== "nb_parcelle") {
                                        parcelles+=("parcelles : "+ object[property]+" ")
                                    } else if (property==="surface_cult_ha") {
                                        val=(object[property])
                                    } else if (property==="culture") {
                                        col_name=(object[property])
                                    }
                                }

                                data.push({
                                    values: val,
                                    labels: col_name,
                                    domain: {column: col_max},
                                    name: nameY,
                                    hoverinfo: 'label+percent+name',
                                    type: 'pie'
                                })
                                annotations.push({
                                    font: {size: 20},
                                    showarrow: false,
                                    text: nameY,
                                    x: decal,
                                    y: 1.2},
                                    {font: {size: 15},
                                    showarrow: false,
                                    text: surf,
                                    x: decal,
                                    y: 1.12},
                                    {font: {size: 15},
                                    showarrow: false,
                                    text: parcelles,
                                    x: decal,
                                    y: 1.06}
                                )
                            col_max+=1
                            }
                        });
                        var layout = {
                            title: 'Répartition des cultures, sbv : '+feature.get('sbv')+ ' (info en ha)',
                            font: {
                                family: "'Poppins', sans-serif"
                            },
                            annotations: annotations,
                            height: 400,
                            width: 1200,
                            showlegend: true,
                            grid: {rows: 1, columns: col_max+1}
                        };
                        Plotly.newPlot($("#graphFlowSimulated")[0], data, layout)
                        Plotly.newPlot($("#graphFlowSimulatedExtend")[0], data, layout)
                    } else if (feature.get('station') != undefined) {


                        _parametre=$("#parametre").val()
                        station_qualite=feature.get('station')
                        date_min=feature.get('date_min')
                        date_max=feature.get('date_max')

                        $.ajax({
                            type: "GET",
                            dataType: "json",
                            url: "https://hubeau.eaufrance.fr/api/v1/qualite_rivieres/analyse_pc",
                            data:'code_station='+feature.get('station')+'&code_parametre=1340&code_qualification=1&fields=date_prelevement,resultat',

                            success: function(data){

                                if ($("#graphFlowSimulated").children().first()) {
                                    $("#graphFlowSimulated").children().first().remove();
                                    $("#graphFlowSimulatedExtend").children().first().remove();
                                }
                                if (data.data.length==0){
                                    alert("Hub-Eau ne répond pas")
                                }
                                else {
                                    plotFlowandNutriment(data,feature.get('station'))
                                }
                            }
                        });
                    }
                }
            }
        var evtKey=_map.on('click', function(evt) {
            if (evt.dragging) {
                return;
            };
        var pixel = _map.getEventPixel(evt.originalEvent);
        displayFeatureInfoDFA(pixel);
        });
        return evtKey;
    }

    return {
        /*
         * Public
         */

        init: function () {
            // mandatory - code executed when panel is opened
            $(".list-group-item.mv-layer-details.draggable[data-layerid='fluxExu'] .row.layerdisplay-legend").hide();
            $(".mv-layer-options[data-layerid='fluxExu'] .form-group-opacity").hide();
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
        hide_couche : function(name){
            if (name=="cheptel"){
                if (cheptel_statut ==true){
                    cheptelLayer.setVisible(false)
                    cheptel_statut =false
                } else {
                    cheptelLayer.setVisible(true)
                    cheptel_statut =true
                }
            }
        },
        check_bv_baie: function (bv_baie) {

            if (bv_baie==="baie"){
                $("#bv").attr('checked', false);
                $("#baie").attr('checked', true);
            } else {
                $("#bv").attr('checked', true);
                $("#baie").attr('checked', false);
            }

        },
        restart: function () {

            if ($("#graphFlowSimulated").children().first()) {
                $("#divPopup1").empty();
                $("#graphFlowSimulated").children().first().remove();
                $("#graphFlowSimulatedExtend").children().first().remove();

            }

            if ($("#legendwms").children().first()) {
                $("#legendwms").remove();
            }
            deleteLayers(["waterLayer"])
            deleteLayers(["mntWms"]);
            deleteLayers(["exutoireLayer"]);

        },
        getOutlets: function () {
            if (_processing === false) {

                if (exutoire_statut ===false) {

                    $("#dismiss").toggleClass("hidden");

                    taille=$("#seuil_bv").val()

                    if (taille==undefined){
                        taille=100
                    }


                    var dictInputs = {
                        surface_min: taille
                    };
                    // construit la requete wps
                    _rqtWPS = buildPostRequest(dictInputs, getExutoire);
                    // defini des valeurs globales dans le cas d'une reexecution
                    // si le process posse en file d'attente et execute le process
                    _refreshTime = 2000;
                    _timeOut = 100000;
                    _timerCountdown = 2;
                    _display = document.querySelector('#countdown');
                    // supprimer les couches
                    processingBarUpdate(0, "Initialisation");
                    processExecution();
                    _processing = true;
                    // supprime les resultats du precedent process
                    if ($("#graphFlowSimulated").children().first()) {
                        $("#divPopup1").empty();
                    }

                    if ($("#graphFlowSimulated").children().first()) {
                        $("#graphFlowSimulated").children().first().remove();
                        $("#graphFlowSimulatedExtend").children().first().remove();
                    }
                    deleteLayers(["exutoireLayer"]);
                    // affiche le panneau de resultat
                    if ($("#bottom-panel").hasClass("")) {
                        $("#bottom-panel").toggleClass("active");
                    }
                } else {
                    deleteLayers(["exutoireLayer"]);
                    exutoire_statut=false
                }
            } else {
                // translate
                if (mviewer.lang.lang == "en") {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Warning',
                        text: "Please wait until the end of the process before running a new one, if the process is locked refresh the page",
                    });

                } else {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Warning',
                        text: "Veuillez attendre la fin du process avant d'en exécuter un nouveau, si vous êtes bloqué actualiser la page",
                    });
                }
            }
        },
        getExu: function () {
            if (_processing === false) {
                if ($('#bv').is(":checked")){
                    if (!_draw) {
                        var curseur = new ol.style.Style({
                            image: new ol.style.RegularShape({
                                stroke: new ol.style.Stroke({
                                color: 'red',
                                width: 1
                            }),
                            points: 4,
                            radius1: 15,
                            radius2: 1
                            }),
                        });
                        _draw = new ol.interaction.Draw({
                            type: 'Point',
                            style:curseur
                        });
                        _draw.on('drawend', function (event) {
                            _xy = ol.proj.transform(event.feature.getGeometry().getCoordinates(), 'EPSG:3857', 'EPSG:2154');
                            mviewer.getMap().removeInteraction(_draw);
                            var template = '{x},{y}';
                            coord = ol.coordinate.format(_xy, template);

                            // si le point clique dans la zone n'est pas dans le projet, ne lance pas le service
                            if (insideProjectArea(String(_xy).split(',')[0], String(_xy).split(',')[1]) === true) {
                                // dismiss button appear
                                $("#dismiss").toggleClass("hidden");

                                // defini les parametres x,y du service
                                var dictInputs = {
                                    X: String(_xy).split(',')[0],
                                    Y: String(_xy).split(',')[1],
                                    seuilBv:$("#seuil_bv").val()
                                };
                                // construit la requete wps
                                _rqtWPS = buildPostRequest(dictInputs, _identifierXY);
                                // defini des valeurs globales dans le cas d'une reexecution
                                // si le process posse en file d'attente et execute le process
                                _refreshTime = 2000;
                                _timeOut = 100000;
                                _timerCountdown = 2;
                                _display = document.querySelector('#countdown');
                                // supprimer les couches
                                deleteLayers(["TargetWatershed","qualiteLayer","mntWms"]);
                                processingBarUpdate(0, "Initialisation");
                                processExecution();
                                _processing = true;

                                // supprime les resultats du precedent process
                                if ($("#graphFlowSimulated").children().first()) {
                                $("#divPopup1").empty();
                                }

                                if ($("#graphFlowSimulated").children().first()) {
                                    $("#graphFlowSimulated").children().first().remove();
                                    $("#graphFlowSimulatedExtend").children().first().remove();
                                }

                                // affiche le panneau de resultat
                                if ($("#bottom-panel").hasClass("")) {
                                    $("#bottom-panel").toggleClass("active");
                                }
                                _draw = "";
                            } else {
                                // translate
                                if (mviewer.lang.lang == "en") {
                                    Swal.fire({
                                        icon: 'warning',
                                        title: 'Warning',
                                        text: "Please click in the TNT project area",
                                    });

                                } else {
                                    Swal.fire({
                                        icon: 'warning',
                                        title: 'Attention',
                                        text: "Veuillez cliquer dans la zone du projet TNT",
                                    });
                                }
                                _map.addInteraction(_draw);
                            }
                        });
                        _map.addInteraction(_draw);
                        var snap = new ol.interaction.Snap({
                            source: exutoireLayer.getSource(),
                        });
                        _map.addInteraction(snap);

                    } else {
                        // translate
                        if (mviewer.lang.lang == "en") {
                            Swal.fire({
                                icon: 'warning',
                                title: 'Warning',
                                text: "You have already activated the tool, please click on the map",
                            });
                        } else {
                            Swal.fire({
                                icon: 'warning',
                                title: 'Attention',
                                text: "Vous avez déjà activé l'outil, veuillez cliquer sur la carte",
                            });
                        }
                    }
                } else{alert("mode baie inactif")}
            } else {
                // translate
                if (mviewer.lang.lang == "en") {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Warning',
                        text: "Please wait until the end of the process before running a new one, if the process is locked refresh the page",
                    });

                } else {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Warning',
                        text: "Veuillez attendre la fin du process avant d'en exécuter un nouveau, si vous êtes bloqué actualiser la page",
                    });
                }
            }
        },
        getDEM: function () {
            if (_processing === false) {

                if ($("#nom_createur").val()=='user'){
                    Swal.fire({
                        icon: 'info',
                        title: '🧐',
                        text: "Afin de faciliter la tache du pauvre développeur que je suis,  🙏 veuillez utiliser un nom d'utilisateur autre que \'user\', ça me facilitera \
                        la tache pour chercher des bugs et je pourrais aussi directement \
                        vous contacter si je vois un bug en direct 🤯",
                    });
                } else {
                    if ($("#legendwms").children().first()) {
                            $("#legendwms").remove();
                    }
                    $("#dismiss").toggleClass("hidden");
                    // defini les parametres x,y du service
                    if ($("#identifiantSimulation").val()) {

                        if (bv_json !== undefined){

                            simulationName=$("#identifiantSimulation").val().toLowerCase().replace(/[`~!@#$%^&*()_|+ \-=?;:'",.<>\{\}\[\]\\\/]/gi, '_');
                            resolution_user=parseInt($("#resolution").val())

                            var dictInputs = {
                                nom: simulationName,
                                bbox: boundingBox,
                                correction:"aucune",
                                resolution:resolution_user,
                                username:$("#nom_createur").val().toLowerCase().replace(/[`~!@#$%^&*()_|+ \-=?;:'",.<>\{\}\[\]\\\/]/gi, '_'),
                                seuil:5,
                                bassin_versant:bv_json
                            }

                            // construit la requete wps
                            _rqtWPS = buildPostRequest(dictInputs, _extratctDem);
                            // defini des valeurs globales dans le cas d'une reexecution
                            // si le process posse en file d'attente et execute le process
                            _refreshTime = 2000;
                            _timeOut = 100000;
                            _timerCountdown = 60;
                            _display = document.querySelector('#countdown');
                            // supprimer les couches
                            deleteLayers(["qualiteLayer","mntWms","exutoireLayer"]);
                            processingBarUpdate(0, "Initialisation");
                            processExecution();
                            _processing = true;

                            // supprime les resultats du precedent process
                            if ($("#graphFlowSimulated").children().first()) {
                                $("#divPopup1").empty();
                            }

                            if ($("#graphFlowSimulated").children().first()) {
                                $("#graphFlowSimulated").children().first().remove();
                                $("#graphFlowSimulatedExtend").children().first().remove();
                            }

                            // affiche le panneau de resultat
                            if ($("#bottom-panel").hasClass("")) {
                                $("#bottom-panel").toggleClass("active");
                            }
                        } else {
                            alert("Le bassin versant n'a pas été généré");
                        }
                    } else {
                        alert("donner un nom à la simulation");
                    }
                dem=true
                }

            } else {
                // translate
                if (mviewer.lang.lang == "en") {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Warning',
                        text: "Please wait until the end of the process before running a new one, if the process is locked refresh the page",
                    });

                } else {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Warning',
                        text: "Veuillez attendre la fin du process avant d'en exécuter un nouveau, si vous êtes bloqué actualiser la page",
                    });
                }
            }
        },
        fitSol: function(){
            if (_processing === false) {
                if (dem==true){
                    $("#btn_sol").css("border-color","var(--mycolor)");
                    deleteLayers(["mntWms"]);
                    if ($("#legendwms").children().first()) {
                        $("#legendwms").remove();
                    }
                    if ($("#divPopup1").children().first()) {
                        $("#divPopup1").empty();
                        if ($("#graphFlowSimulated").children().first()) {
                            $("#graphFlowSimulated").children().remove();
                            $("#graphFlowSimulatedExtend").children().remove();
                        }
                    }
                    if ($("#bottom-panel").hasClass("")) {
                        $("#bottom-panel").toggleClass("active");
                    }

                    solLayer.setVisible(true)

                    cheptelLayer.setVisible(false)
                    if (dfaLayer != undefined){
                        dfaLayer.setVisible(false)
                    }
                    let format = new ol.format.GeoJSON({featureProjection: 'EPSG:3857'});
                    let poly_coord = solLayer.getSource().getFeatures();
                    solCanton = format.writeFeatures(poly_coord);

                    key_gap=function () {};
                    //key_gap=show_info_multi(solLayer)
                    geoj = data_sol.features.filter((obj, pos, arr) => {
                        return arr.map(mapObj =>
                            mapObj.properties.N_UCS).indexOf(obj.properties.N_UCS) == pos;
                    });
                    tableau="<div id='table_sol_div'><table id='table_sol' border=1><thead><tr>"
                    for ( let key in geoj[0].properties) {
                        if (key != "color"){
                            tableau+='<th style="text-align:center">&nbsp;' + key + '&nbsp;</th>';
                        }
                    }

                    for (var i = 0; i < geoj.length; i++) {
                        tableau+='<tr>';
                    //class bootstrap ne marche pas pour les liens ?
                    tableau+=('<td style="text-align:center" id="ucs_'+i+'">' + '<a style="color:blue;text-decoration: underline;" href="http://apisol.geosas.fr/public/Fiches_UCS/'+geoj[i].properties.NO_ETUDE+'/'+geoj[i].properties.N_UCS+'.pdf" target="_blank">'+geoj[i].properties.N_UCS+' </a></td>');
                    tableau+=('<td style="text-align:center">' + geoj[i].properties.MAT_DOM + '</td>');
                    tableau+=('<td style="text-align:center">' + geoj[i].properties.DRAI_DOM + '</td>');
                    tableau+=('<td style="text-align:center">' + geoj[i].properties.EPAIS_DOM + '</td>');
                    tableau+=('<td style="text-align:center">' + geoj[i].properties.TEXT_DOM + '</td>');
                    tableau+=('<td style="text-align:center">' + geoj[i].properties.NO_ETUDE + '</td>');
                    tableau+=('<td style="text-align:center"><input type="text" id="sol_'+i+'" required minlength="1" maxlength="2" value="'+geoj[i].properties.categorie+'"></td></tr>');
                    }
                    tableau+=("</tbody></table>");
                    tableau+='<a href="http://geowww.agrocampus-ouest.fr/metadata/Description_metadonnees.html" \
                    target="_blank"> Propriétés pédologiques - Description des champs</a>'
                    $("#graphFlowSimulated").append(tableau)
                    $("#graphFlowSimulated").css("background-color","#ffffff");
                    $("#divPopup1").append([
                        "<div class='titre_bottom' >Caractéristiques des sols</div>",
                        "<div><i class='fas fa-arrow-right'></i> Dans le tableau, classifiez les UCS selon leurs types de matériaux dominants.",
                        '<br><br><br><button class="btnTNT btn_vert" onclick="mviewer.customControls.fluxExu.classement_sol()"><i class="fas fa-plus-circle"></i> Ajouter</button></div>'].join(''));
                } else { alert("MNT non généré")}
            } else { alert("process en cours, attendez")}
        },
        classement_sol: function(){

            if (_processing === false) {

                dict_sol =  { "classement":[]}

                for (i=0;i<geoj.length;i++){

                ucs=$('#ucs_'+i).text();
                sol=$('#sol_'+i).val();


                dict_sol.classement.push( {"ucs":ucs, "classe":sol} )
                }
                dict_sol=JSON.stringify(dict_sol)

                $("#dismiss").toggleClass("hidden");

                if (dict_sol != undefined){
                    var dictInputs = {
                        classe: dict_sol,
                        projet: simulationName
                    };

                    // construit la requete wps
                    _rqtWPS = buildPostRequest(dictInputs, postSol);
                    // defini des valeurs globales dans le cas d'une reexecution
                    // si le process posse en file d'attente et execute le process
                    _refreshTime = 2000;
                    _timeOut = 100000;
                    _timerCountdown = 2;
                    _display = document.querySelector('#countdown');
                    // supprimer les couches
                    processingBarUpdate(0, "Initialisation");
                    processExecution();
                    _processing = true;

                } else {
                   alert("La couche sol n'a pas été générées");
                }
            } else {
                // translate
                if (mviewer.lang.lang == "en") {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Warning',
                        text: "Please wait until the end of the process before running a new one, if the process is locked refresh the page",
                    });

                } else {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Warning',
                        text: "Veuillez attendre la fin du process avant d'en exécuter un nouveau, si vous êtes bloqué actualiser la page",
                    });
                }
            }

        },
        affCheptel : function() {

            if ($("#bottom-panel").hasClass("")) {
                $("#bottom-panel").toggleClass("active");
            }
            deleteLayers(["mntWms"]);
            deleteLayers(["dfaLayer"]);
            if ($("#legendwms").children().first()) {
                $("#legendwms").remove();
            }
            $("#btn_dfa").css("border-color","var(--mycolor)");
            cheptelLayer.setVisible(true)
            _map.removeInteraction(selection_station)
            solLayer.setVisible(false)
            let format = new ol.format.GeoJSON({featureProjection: 'EPSG:3857'});
            let poly_coord = cheptelLayer.getSource().getFeatures();
            dfaCanton = format.writeFeatures(poly_coord);

            key_gap=function (){};
            key_gap=show_info_multi(cheptelLayer);
            if ($("#graphFlowSimulated").children().first()) {
                $("#divPopup1").empty();
                $("#graphFlowSimulated").children().first().remove();
                $("#graphFlowSimulatedExtend").children().first().remove();
            }

            $("#divPopup1").append([
                "<div class='titre_bottom' >Déclaration des flux d'azote (DFA) </div>",
                "<div><i class='fas fa-arrow-right'></i> Veuillez sélectionner sur la carte les cantons dont les données",
                " DFA seront ajoutées au référentiel</br><i>SHIFT+CLIC : sélectionner plusieurs cantons</i></div>",
                '<div class="custom-control custom-switch">',
                '<input type="checkbox" checked class="custom-control-input" id="customSwitches_dfa" onclick="mviewer.customControls.fluxExu.hide_couche(\'cheptel\');">',
                '<label class="custom-control-label" for="customSwitches_dfa" >Contour des cantons</label></div>',
                '<div class="custom-control custom-switch">',
                '<input type="checkbox" class="custom-control-input" id="customSwitches" onclick="mviewer.customControls.fluxExu.ocs_wms();">',
                '<label class="custom-control-label" for="customSwitches" >Afficher l\'occupation du sol </label></div><br>',
                '<button class="btnTNT btn_vert2" onclick="mviewer.customControls.fluxExu.fitDfa1(\'m1\');">',
                '<i class="fas fa-plus-circle"></i> Utiliser tous les cantons</button>',
                '<button class="btnTNT btn_vert" onclick="mviewer.customControls.fluxExu.fitDfa2();">',
                '<i class="fas fa-plus-circle"></i> Ajouter la sélection</button>'].join(''));
            $("#graphFlowSimulated").append("<div class='blockNoData'><img class='imgNoData' src='apps/mviewer-tnt/img/data_nocanton.svg'><p><i>Sélectionnez un canton sur la carte pour afficher les informations sur les flux d'azote associées</i></p></div>");
            $("#graphFlowSimulated").css("background-color","#80808012");
        },
        fitDfa1: function (methode) {
            if (_processing === false) {

                $("#dismiss").toggleClass("hidden");

                if (dfaCanton != undefined){

                    var dictInputs = {
                        methode:methode,
                        projet:simulationName
                    };

                    // construit la requete wps
                    _rqtWPS = buildPostRequest(dictInputs, FitData);
                    // defini des valeurs globales dans le cas d'une reexecution
                    // si le process posse en file d'attente et execute le process
                    _refreshTime = 2000;
                    _timeOut = 100000;
                    _timerCountdown = 2;
                    _display = document.querySelector('#countdown');
                    // supprimer les couches
                    processingBarUpdate(0, "Initialisation");
                    processExecution();
                    _processing = true;

                    // supprime les resultats du precedent process
                    if ($("#graphFlowSimulated").children().first()) {
                        $("#divPopup1").empty();
                    }

                    if ($("#graphFlowSimulated").children().first()) {
                        $("#graphFlowSimulated").children().first().remove();
                        $("#graphFlowSimulatedExtend").children().first().remove();
                    }

                    // affiche le panneau de resultat
                    if ($("#bottom-panel").hasClass("")) {
                        $("#bottom-panel").toggleClass("active");
                    }
                } else {
                   alert("Les DFA par canton n'ont pas été générées");
                }
            } else {
                // translate
                if (mviewer.lang.lang == "en") {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Warning',
                        text: "Please wait until the end of the process before running a new one, if the process is locked refresh the page",
                    });

                } else {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Warning',
                        text: "Veuillez attendre la fin du process avant d'en exécuter un nouveau, si vous êtes bloqué actualiser la page",
                    });
                }
            }
        },
        fitDfa2: function(){

                cantonSelected= (selection1.getArray().map(function(feature) {

                    return feature.values_.nom_geo;

                }));
                if (cantonSelected.length != 0){
                    mviewer.customControls.fluxExu.fitDfa1(cantonSelected)
                } else {
                    alert("Veuillez sélectionner au moins un canton")
                }

        },
        ocs_wms: function(){

            if (ocs_statut==true) {
                if ($("#legendwms").children().first()) {
                    $("#legendwms").remove();
                    deleteLayers(["mntWms"]);
                }
                plotMNT('http://psncalc.agrocampus-ouest.fr/tntserver/'+simulationName+'/wms','_occupation_du_sol')
                sbv_ocsLayer.setVisible(true)
                ocs_statut=false
            } else {
                if ($("#legendwms").children().first()) {
                    $("#legendwms").remove();
                    deleteLayers(["mntWms"]);
                    sbv_ocsLayer.setVisible(false)
                }
                ocs_statut=true
            }
        },
        plot_rpg : function(){

            $("#btn_rpg").css("border-color","var(--mycolor)");
            if (rpg_info != undefined){
                if ($("#bottom-panel").hasClass("")) {
                    $("#bottom-panel").toggleClass("active");
                }

                if ($("#legendwms").children().first()) {
                    $("#legendwms").remove();
                    deleteLayers(["mntWms"]);
                }


                sbv_ocsLayer.setVisible(false)
                if (dfaLayer != undefined){
                    dfaLayer.setVisible(false)
                }

                sbv_rotationLayer.setVisible(true)
                plotMNT('http://psncalc.agrocampus-ouest.fr/tntserver/'+simulationName+'/wms','_rpg_2019')
                if ($("#divPopup1").children().first()) {
                    $("#divPopup1").empty();
                    if ($("#graphFlowSimulated").children().first()) {
                        $("#graphFlowSimulated").children().first().remove();
                        $("#graphFlowSimulatedExtend").children().first().remove();
                    }
                }
                $("#divPopup1").append([
                    "<div class='blockRPG'><div class='titre_bottom' > Registre parcellaire graphique (RPG) </div>",
                    "<div class='textRPG'><i class='fas fa-arrow-right'></i> Veuillez sélectionner le millésime RPG de référence dont les données seront ajoutées au référentiel</div>",
                    "<div class='inputRPG'><label for='year-select'>Millésime du RPG de référence :</label><br>",
                    "<select name='year_rpg_wms' id='year_rpg_wms' onchange='mviewer.customControls.fluxExu.rpg_wms(this.value)'>",
                    "<option value='2019'>2019</option>",
                    "<option value='2018'>2018</option>",
                    "<option value='2017'>2017</option>",
                    "<option value='2016'>2016</option>",
                    "<option value='2015'>2015</option></select></div>",
                    "<button class='btnTNT btn_vert' onclick='mviewer.customControls.fluxExu.valider_rpg()'><i class='fas fa-plus-circle'></i> Ajouter</button>",
                    "</div>"].join(""));   
                data=[]
                annotations=[]
                decal=-0.2
                col_max=0

                $.each(rpg_info, function(index, object) {
                    if (object.ogc_fid===0){
                        decal+=0.2
                        val=[]
                        col_name=[]
                        surf=""
                        parcelles=""

                        for (var property in object) {
                            if (property==="annee"){
                                nameY=object[property]
                            } else if (property==="surface") {
                                surf+=(property + " : "+ object[property]+" ha")
                            } else if (property=== "nb_parcelle") {
                                parcelles+=("parcelles : "+ object[property]+" ")
                            } else if (property==="surface_cult_ha") {
                                val=(object[property])
                            } else if (property==="culture") {
                                col_name=(object[property])
                            }
                        }

                        data.push({
                            values: val,
                            labels: col_name,
                            domain: {column: col_max},
                            name: nameY,
                            hoverinfo: 'label+percent+name',
                            type: 'pie'
                        })
                        annotations.push({
                            font: {size: 20},
                            showarrow: false,
                            text: nameY,
                            x: decal,
                            y: 1.2},
                            {font: {size: 12},
                            showarrow: false,
                            text: surf,
                            x: decal,
                            y: 1.12},
                            {font: {size: 12},
                            showarrow: false,
                            text: parcelles,
                            x: decal,
                            y: 1.06}
                        )
                    col_max+=1
                    }
                });
                var layout = {
                    title: 'Évolution de la répartition des cultures selon les catégories (en ha)',
                    annotations: annotations,
                    font: {
                        family: "'Poppins', sans-serif"
                    },
                    height: 350,
                    width: 1000,
                    showlegend: true,
                    grid: {rows: 1, columns: col_max+1}
                };
                Plotly.newPlot($("#graphFlowSimulated")[0], data, layout)
                Plotly.newPlot($("#graphFlowSimulatedExtend")[0], data, layout)

            }
            else {alert("RPG non chargé")}
        },
        valider_rpg:function(){
            if ($("#legendwms").children().first()) {
                $("#legendwms").remove();
                deleteLayers(["mntWms"]);
            }
            sbv_rotationLayer.setVisible(false)
            $("#bottom-panel").toggleClass("active");

            $("#btn_rpg").css("background-color","var(--mycolor)");
            $("#btn_rpg").css("color","white");
        },
        rpg_wms: function(year_wms){
            if ($("#legendwms").children().first()) {
                $("#legendwms").remove();
                deleteLayers(["mntWms"]);
            }
            plotMNT('http://psncalc.agrocampus-ouest.fr/tntserver/'+simulationName+'/wms','_rpg_'+year_wms)
        },
        qualityStation: function(){

            $("#btn_station").css("border-color","var(--mycolor)");
            if ($("#graphFlowSimulated").children().first()) {
                $("#divPopup1").empty();
            }

            if ($("#graphFlowSimulated").children().first()) {
                $("#graphFlowSimulated").children().remove();
                $("#graphFlowSimulatedExtend").children().first().remove();
            }
                        // affiche le panneau de resultat
            if ($("#bottom-panel").hasClass("")) {
                $("#bottom-panel").toggleClass("active");
            }

            $("#divPopup1").append([
                "<div class='blockEau'> <div class='titre_bottom' >Station qualité (NO3-) </div>",
                    '<label class="input_long"><i class="fas fa-arrow-right"></i> Indiquez un nombre d\'enregistrement minimum :',
                    '<input type="text" id="seuil_rec" name="seuil_rec" value="10" size="4"></label>',
                    '<button class="btnTNT btn_vert2" onclick="mviewer.customControls.fluxExu.addQualityStation();">Afficher les stations</button>',
                    "<div class='legendEau'>Estimation du nombre d'enregistrement à l'année : <br><img class='imgLegendStation' src='apps/mviewer-tnt/img/legend_station.svg'></div>",
                    "<div class='textEau'> <i class='fas fa-arrow-right'></i> Veuillez sélectionner sur la carte les stations qualités dont les enregistrements seront ajoutés au référentiel.<br> SHIFT+CLIC : sélectionner plusieurs stations</div>",                    
                    '<br><button class="btnTNT btn_vert" onclick="mviewer.customControls.fluxExu.ajout_station();">',
                    '<i class="fas fa-plus-circle"></i> Ajouter la sélection</button></div>'].join(''));
                    $("#graphFlowSimulated").append("<div class='blockNoData'><img class='imgNoData' src='apps/mviewer-tnt/img/data_nostation.svg'><p><i>Sélectionnez une station sur la carte pour afficher les informations associées</i></p></div>");
                    $("#graphFlowSimulated").css("background-color","#80808012");            
        },
        addQualityStation: function(){
            if (_processing === false) {

                if ($("#identifiantSimulation").val()) {

                    $("#dismiss").toggleClass("hidden");

                        var dictInputs = {
                            seuil:$("#seuil_rec").val(),
                            bassin_versant:bv_json
                            }
                    // construit la requete wps
                    _rqtWPS = buildPostRequest(dictInputs, getStation);
                    // defini des valeurs globales dans le cas d'une reexecution
                    // si le process posse en file d'attente et execute le process
                    _refreshTime = 2000;
                    _timeOut = 100000;
                    _timerCountdown = 2;
                    _display = document.querySelector('#countdown');
                    // supprimer les couches
                    processingBarUpdate(0, "Initialisation");
                    processExecution();
                    _processing = true;

                    if ($("#graphFlowSimulated").children().first()) {
                        $("#graphFlowSimulated").children().remove();
                        $("#graphFlowSimulatedExtend").children().first().remove();
                    }


                } else { alert("donner un nom à la simulation");}

            } else {
                    // translate
                    if (mviewer.lang.lang == "en") {
                        Swal.fire({
                            icon: 'warning',
                            title: 'Warning',
                            text: "Please wait until the end of the process before running a new one, if the process is locked refresh the page",
                        });

                    } else {
                        Swal.fire({
                            icon: 'warning',
                            title: 'Warning',
                            text: "Veuillez attendre la fin du process avant d'en exécuter un nouveau, si vous êtes bloqué actualiser la page",
                        });
                    }
            }
        },
        ajout_station: function () {
            _stationsSelectedByUser= (selection1.getArray().map(function(feature) {
                return feature.values_.station;
            }));
            deleteLayers(["qualiteLayer"]);

            if ($("#legendwms").children().first()) {
                $("#legendwms").remove();
            }

            $("#bottom-panel").toggleClass("active");
            if ($("#graphFlowSimulated").children().first()) {
                $("#divPopup1").empty();
                $("#graphFlowSimulated").children().first().remove();
                $("#graphFlowSimulatedExtend").children().first().remove();
            }
            Swal.fire({
                icon: 'success',
                text: "Les stations qualités ont été ajoutées au référentiel",
            });
            $("#btn_station").css("background-color","var(--mycolor)");
            $("#btn_station").css("color","white");
            referentiel=true
        },
        getURL: function () {
            if (_processing === false) {
                if (referentiel ==true) {
                $("#dismiss").toggleClass("hidden");
                    var dictInputs = {
                        MNT_Utilise: simulationName,
                        X:X,
                        Y:Y,
                        station_qualite:_stationsSelectedByUser
                    };

                    // construit la requete wps
                    _rqtWPS = buildPostRequest(dictInputs, getUrlP);
                    // defini des valeurs globales dans le cas d'une reexecution
                    // si le process posse en file d'attente et execute le process
                    _refreshTime = 2000;
                    _timeOut = 100000;
                    _timerCountdown = 30;
                    _display = document.querySelector('#countdown');
                    // supprimer les couches
                    processingBarUpdate(0, "Initialisation");
                    processExecution();
                    _processing = true;
                    // supprime les resultats du precedent process
                    if ($("#graphFlowSimulated").children().first()) {
                        $("#divPopup1").children().remove();
                    }

                    if ($("#graphFlowSimulated").children().first()) {
                        $("#graphFlowSimulated").children().first().remove();
                        $("#graphFlowSimulatedExtend").children().first().remove();
                    }

                    // affiche le panneau de resultat
                    if ($("#bottom-panel").hasClass("")) {
                        $("#bottom-panel").toggleClass("active");
                    }
                } else {
                   alert("Tous les paramètres n'ont pas été définis");
                }
            } else {
                // translate
                if (mviewer.lang.lang == "en") {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Warning',
                        text: "Please wait until the end of the process before running a new one, if the process is locked refresh the page",
                    });
                } else {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Warning',
                        text: "Veuillez attendre la fin du process avant d'en exécuter un nouveau, si vous êtes bloqué actualiser la page",
                    });
                }
            }
        },
        destroy: function () {
           // mandatory - code executed when layer panel is closed à faire !
        }
    };
}());