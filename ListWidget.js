/*
 * Copyright 2015 Esri
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *   http://www.apache.org/licenses/LICENSE-2.0

 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
define([
  "dojo/_base/declare",
  'dojo/on',
  "dojo/_base/lang",
  "dijit/_WidgetBase",
  "dijit/_TemplatedMixin",
  "dgrid/OnDemandList",
  "dgrid/Selection",
  "dojo/store/Memory",
  "dojo/store/Observable",
  "dojo/dom-construct",
  "esri/opsdashboard/WidgetProxy",
  "esri/opsdashboard/WidgetConfigurationProxy",
  "esri/opsdashboard/MapWidgetProxy",
  "esri/tasks/query",
  "esri/tasks/QueryTask",
   "esri/renderers/SimpleRenderer",
    "esri/symbols/SimpleFillSymbol",
    "esri/graphic",
    "esri/Color",
  "dojo/text!./ListWidgetTemplate.html"
], function (declare, on, lang, _WidgetBase, _TemplatedMixin, List, Selection, Memory, Observable, domConstruct, WidgetProxy, WidgetConfigurationProxy, MapWidgetProxy, Query, QueryTask, SimpleRenderer, SimpleFillSymbol, Graphic, Color,templateString) {

  return declare("ListWidget", [_WidgetBase, _TemplatedMixin, WidgetProxy], {
    templateString: templateString,
    debugName: "LIstWidget",

    hostReady: function () {

      // Create the store we will use to display the features
      this.store = new Observable(new Memory());
      //temporary local storage to hold the featureActionFeatures
      this.featureActionFeaturesStore = new Observable(new Memory());
      //cache the featureActionFeatures
      this.featureActionFeaturesCache = new Observable(new Memory());
      
      // Create the list and override the row rendering
      var dataSourceProxy = this.dataSourceProxies[0];
      
      var dataSourceConfig = this.getDataSourceConfig(dataSourceProxy);
      this.list = new (declare([List, Selection]))({
        store: this.store,
        cleanEmptyObservers: false,
        selectionMode: this.isNative ? "extended" : "toggle",
        renderRow: function (feature) {
            var divNode = domConstruct.create('div', { className: "item" });

          var para = document.createElement("h3");
          var t = document.createTextNode(feature.attributes['Ward_No']);
          para.appendChild(t);
          domConstruct.place(para, divNode);

          domConstruct.place(document.createElement("br"),divNode);
          

          var para = document.createElement("u");
          var t = document.createTextNode('Complainant Name: ' + feature.attributes['Comp_Name']);
          para.appendChild(t);
          domConstruct.place(para, divNode);
          domConstruct.place(document.createElement("br"), divNode);
          domConstruct.place(document.createElement("br"), divNode);
          domConstruct.place(document.createTextNode('Complaint Log Date: ' + feature.attributes['Comp_LogDa']), divNode);
          domConstruct.place(document.createElement("br"), divNode);
          domConstruct.place(document.createTextNode('Complaint Status: ' + feature.attributes['Status']), divNode);
          domConstruct.place(document.createElement("br"), divNode);
          domConstruct.place(document.createTextNode('Complaint Type: ' + feature.attributes['Comp_Type']), divNode);
          domConstruct.place(document.createElement("br"), divNode);
          domConstruct.place(document.createTextNode('Complaint Satisfaction: ' + feature.attributes['Satisfacti']), divNode);
          domConstruct.place(document.createElement("br"), divNode);
          domConstruct.place(document.createTextNode('Complaint Action: ' + feature.attributes['Action_Rep']), divNode);
          return divNode;
        }
      }, this.listDiv);

      this.list.startup();

      //add the selected feature to the list of featureActionFeatures
      this.list.on("dgrid-select", function (event) {
          event.rows.forEach(function (row) {
              var renderer = new SimpleRenderer(
                    new SimpleFillSymbol("solid", null, new Color([255, 0, 255, 0.75]) // fuschia lakes!
                ));
              rajatsThis = this;
              var queryTask = new QueryTask('https://services6.arcgis.com/aCvWTD6jxu9gjnYb/arcgis/rest/services/DJBWardsClassified/FeatureServer/0');
              var query = new Query();
              query.where = "WARDNAME='" + row.data.attributes.Ward_No + "'";
              query.outFields = ['*'];
              query.outSpatialReference = this.customMapWidgetProxy[0].spatialReference;
              query.returnGeometry = true;
              queryTask.execute(query, function (result) {
                  if (result.features.length > 0) {
                      rajatsThis.customMapWidgetProxy[0].createGraphicsLayerProxy({
                          renderer: renderer
                      }).then(function (microResult) {
                          microResult.addOrUpdateGraphic(new Graphic(result.features[0].geometry, new SimpleFillSymbol("solid", null, new Color([255, 0, 255, 0.75]))));
                          setTimeout(function () {
                              microResult.clear()
                          }, 4000);
                      });
                      rajatsThis.customMapWidgetProxy[0].setExtent(result.features[0].geometry.getExtent());
                  }
                  else alert('No Geometry');
              });
          if (this.featureActionFeatures) {
            this.featureActionFeatures.addFeature(row.data);
            this.featureActionFeaturesStore.put(row.data);
          }
        }, this);
      }.bind(this));

      //remove the feature from the list of featureActionFeatures
      this.list.on("dgrid-deselect", function (event) {
          event.rows.forEach(function (row) {
             

          if (this.featureActionFeatures) {
            this.featureActionFeatures.removeFeature(row.data);
            this.featureActionFeaturesStore.remove(row.data.id);
          }
        }, this);
      }.bind(this));

      // Create the query object
      // Query the features and update the chart
      this.query = new Query();
      this.query.outFields = ['*'];
      this.query.returnGeometry = false;
      return this.getMapWidgetProxies().then(lang.hitch(this, function (result) {
          this.customMapWidgetProxy = result;
      }));
    },

    dataSourceExpired: function (dataSourceProxy, dataSourceConfig) {
      // Request data and process them
      //cache the featureActionFeatures before updating the store
      if (this.featureActionFeatures) {
        if (this.featureActionFeaturesStore.data.length > 0) {
          this.featureActionFeaturesCache.query().forEach(function (item) {
            this.featureActionFeaturesCache.remove(item.id);
          }.bind(this));

          this.featureActionFeaturesStore.query().forEach(function (_feature) {
            this.featureActionFeaturesCache.put(_feature);
          }, this);
        }
      }

      if (this.store.data.length > 0) {
        this.store.query().forEach(function (item) {
          this.store.remove(item.id);
        }.bind(this));
      }

      dataSourceProxy.executeQuery(this.query).then(function (featureSet) {
        if (featureSet.features) {
          //update the data store
          featureSet.features.forEach(function (feature) {
            this.store.put(feature, {overwrite: true, id: feature.attributes[dataSourceProxy.objectIdFieldName]});
          }.bind(this));

          //update the featureActionFeatures from the cache after the data store is updated
          if (this.featureActionFeatures && this.featureActionFeaturesCache.data.length > 0) {
            this.featureActionFeatures.clear();
            this.featureActionFeaturesCache.query().forEach(function (_feature) {
              this.featureActionFeatures.addFeature(_feature);
              this.list.select(this.list.row(parseInt(_feature.id)));
            }, this);
          }
        }
      }.bind(this));
    }
  });
});
