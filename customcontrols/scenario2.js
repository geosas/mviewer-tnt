mviewer.customControls.scenario2 = (function () {
  var projet_name
  var _urlWPS = "http://wps.geosas.fr/tnt?";

  function ajaxURL(url) {
    // relative path
    if (url.indexOf('http') !== 0) {
        return url;
    }
    // same domain
    else if (url.indexOf(location.protocol + '//' + location.host) === 0) {
        return url;
    } else {
        return '/proxy/?url=' + encodeURIComponent(url);
    }
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

            if (feature.get('code_station') != undefined) {
                                plotFlowandNutriment(data)
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

  function plotGeojsonQualite(datajson){
    datajson=JSON.parse(datajson)
    console.log(datajson)
    vectorSource=new ol.source.Vector({
        features: new ol.format.GeoJSON().readFeatures(datajson),
    });
    qualiteLayer = new ol.layer.Vector({
        declutter: false,
        source: vectorSource,
        name: "qualiteLayer",
        style: function (feature) {
            col="#17d523"
            if (_map.getView().getZoom()<=11.5){
                return new ol.style.Style({
                    image: new ol.style.RegularShape({
                        fill: new ol.style.Fill({color: col}),
                        stroke: new ol.style.Stroke({
                            color: 'black',
                            width: 1
                        }),
                        points: 3,
                        radius: 6,
                        angle: 0,
                    })
                })
            } else{
                return new ol.style.Style({
                    image: new ol.style.RegularShape({
                        fill: new ol.style.Fill({color: col}),
                        stroke: new ol.style.Stroke({
                            color: 'black',
                            width: 1
                        }),
                        points: 3,
                        radius: 6,
                        angle: 0,
                    }),
                    text:new ol.style.Text({
                        font: '12px Calibri,sans-serif',
                        text: feature.get('code_station'),
                        offsetY: 30,
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
}
function plotMNT(simulationName, couche) {
  projet_name=simulationName;
  layer=simulationName+couche;
  wms='http://psncalc.agrocampus-ouest.fr/tntserver/'+simulationName+'/wms'
  mnt= new ol.layer.Tile({
      name : "mntWms",
      source: new ol.source.TileWMS({
      url: wms,
      params: {'LAYERS': layer, 'TILED': true},
      serverType: 'geoserver'
    })
  })

  //for (var i=0; i<_map.getLayers().getArray().length; i++){
    //  console.log(i + ' ' + _map.getLayers().getArray()[i].getProperties().name)
   //   };
  if (couche==="_altitude"){
      _map.getLayers().insertAt(4,mnt);
  } else {
      _map.addLayer(mnt)
  }

  urlLegend='http://psncalc.agrocampus-ouest.fr/tntserver/'+simulationName+'/ows?service=WMS&request=GetLegendGraphic&format=image%2Fpng&width=20&height=20&layer='+simulationName+couche


  //var img = document.getElementById('legend')
  $('#menu').append('<div id="legendwms" style="text-align: center;"><img src='+urlLegend+'></div>');

}

  function iterateData(xml){

    xml=$.xml2json(xml)
    outputsTags = Object.keys(xml.ProcessOutputs).map(function (itm) {
      return xml.ProcessOutputs[itm];
    });
    for (var i=0 ;i < outputsTags[0].length; i++) {

        if (outputsTags[0][i].Identifier === "debit") {
          if (outputsTags[0][i].Data.ComplexData==="<![CDATA[failed]]>"){
            alert("error get process")
            break;
          }
        }

        else if (outputsTags[0][i].Identifier === "station_qualite_xy") {
          alert("plot station")
          if (outputsTags[0][i].Data.ComplexData==="<![CDATA[failed]]>"){
            alert("error get process")
            break;
          }
          console.log(outputsTags[0][i].Identifier)
          console.log(outputsTags[0][i].Data)
          console.log(outputsTags[0][i].Data.ComplexData)
          plotGeojsonQualite(outputsTags[0][i].Data.ComplexData);
      }
    }
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


  return {
      /*
       * Public
       */

      init: function () {
        // mandatory - code executed when panel is opened
        $(".list-group-item.mv-layer-details.draggable[data-layerid='scenario2'] .row.layerdisplay-legend").hide();
        $(".mv-layer-options[data-layerid='scenario2'] .form-group-opacity").hide();
        $(".mv-nav-item[data-layerid='fluxExu'] ").click();
      },
      getinfos: function(){
        $.ajax({
          type:"GET",
          dataType: "json",
          beforeSend:function(){
            alert("start process");
          },
          url: ajaxURL("http://wps.geosas.fr/tnt?service=WPS&version=1.0.0&request=Execute&identifier=getInfos&rawdataoutput=project_info"),
          success: function(data){
            $('#bottom-panel').toggleClass('active')
              console.log(data)
              //JSON.parse(data1)

          tableau="<div id='table_sol_div'><table id='table_sol' border=1><thead><tr>"

              tableau+='<th style="text-align:center">&nbsp;Projet&nbsp;</th>';
              tableau+='<th style="text-align:center">&nbsp;Date&nbsp;</th>';
              tableau+='<th style="text-align:center">&nbsp;Résolution (m)&nbsp;</th>';
              tableau+='<th style="text-align:center">&nbsp;Utilisateur&nbsp;</th>';


          tableau+='</tr></thead><tbody>';

          for (var i = 0; i < data.length; i++) {
              tableau+='<tr>';


            tableau+=('<td style="text-align:center"><button onclick="mviewer.customControls.scenario2.showProjet(&quot;' + data[i].project+'&quot;)">' + data[i].project+'</button></td>');

            tableau+=('<td style="text-align:center">' + data[i].date + '</td>');
            tableau+=('<td style="text-align:center">' + data[i].resolution + '</td>');
            tableau+=('<td style="text-align:center">' + data[i].owner_name + '</td></tr>');

          }
          tableau+=("</tbody></table>");
          tableau+=
          tableau+=
          $("#divPopup1").append(tableau)
          
          }
        })
      },
      showProjet: function(projetId){
        console.log(projetId)
        $.ajax({
          type:"GET",
          dataType: "xml",
          beforeSend:function(){
            alert("start process");
          },
          url: ajaxURL("http://wps.geosas.fr/tnt?service=WPS&version=1.0.0&request=Execute&identifier=getProjet&datainputs=project="+projetId),
          success: function(data){

            plotMNT(projetId, '_altitude')
            //plotMNT(projetId, '_bassin_versant')
            //plotMNT(projetId, '_occupation_du_sol')
            //plotMNT(projetId, '_rpg_2016')
            //plotMNT(projetId, '_pedologie')
            //plotMNT(projetId, '_dfa')
            try {
              iterateData(data)
            } catch (error) {
              console.error(error);

            }

          },
          error: function (request, status, error) {
            alert(request.status)
            alert(request.responseText);}

        })
      },

      showMap: function(layername){
        
        deleteLayers("mntWms")
        plotMNT(projet_name, layername)
      },

      destroy: function () {
         // mandatory - code executed when layer panel is closed
     }


  };
}());
