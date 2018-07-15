import { Component, AfterViewInit, Input, ViewChild, OnDestroy} from '@angular/core';
import { CoreServiceInjector } from 'app/core/services/coreserviceinjector';
import { CoreService, CoreEvent } from 'app/core/services/core.service';
import { MaterialModule } from 'app/appMaterial.module';
import { NgForm } from '@angular/forms';
import { ChartData } from 'app/core/components/viewchart/viewchart.component';

import { Router } from '@angular/router';
import { UUID } from 'angular2-uuid';
import * as d3 from 'd3';
import * as c3 from 'c3';

import { AnimationDirective } from 'app/core/directives/animation.directive';
import filesize from 'filesize';
//import { WidgetComponent } from 'app/core/components/widgets/widget/widget.component';
import { WidgetChartComponent, TimeData } from 'app/core/components/widgets/widgetchart/widgetchart.component';
import { TranslateService } from '@ngx-translate/core';

import { T } from '../../../../translate-marker';

/*interface TimeData {
  start: number;
  end: number;
  step: number;
  legend?: string;
}*/

@Component({
  selector: 'widget-load',
  templateUrl:'./widgetload.component.html',
  styleUrls: ['./widgetload.component.css']
})
export class WidgetLoadComponent extends WidgetChartComponent implements AfterViewInit, OnDestroy {

  //@ViewChild('chartCpu') chartCpu: ViewChartLineComponent;
  public title:string = T("Load Average");
  public subtitle:string = T("RRDTool load5");
  //public altTitle: string = '';
  //public altSubtitle: string = '';
  public widgetColorCssVar = "var(--violet)";
  //public showLegendValues:boolean = false;
  //public chartId = "chart-" + UUID.UUID();
  //public chart: any;
  //public maxY: number = 100; // Highest number in data

  //public startTime;
  //public endTime;

  constructor(public router: Router, public translate: TranslateService){
    super(router, translate);
  }

  ngOnDestroy(){
    this.core.emit({name:"StatsRemoveListener", data:{name:"Load", obj:this}});
  }

  ngAfterViewInit(){
    this.core.emit({name:"StatsAddListener", data:{name:"Load",key:"midterm", obj:this} });

    this.core.register({observerClass:this,eventName:"StatsLoadMidterm"}).subscribe((evt:CoreEvent) => {
      //DEBUG: console.log(evt);
      this.setChartData(evt);
    });

    this.chartSetup();
  }

  chartSetup(){
    // Generate Regions
    /*let generatedRegions = [];
     for(let i = 0; i < 100; i++){
       let vent = i % 20;
       if(vent == 0){
         generatedRegions.push({axis: 'y', start: i+10, end: i + 20, class: 'regionEven'})
       }
     }*/

     this.chart = c3.generate({
       bindto: '#' + this.chartId,
       size: {
         height:176
       },
       data: {
         x: "x",
         columns: [
           ['x'],
           ['total']
         ],
         type: 'spline',
         colors: {
           total: this.widgetColorCssVar
         },
         onmouseout: (d) => {
           this.showLegendValues = false;
         }
       },
       axis: {
         x: {
           show:false,
           type: 'timeseries',
           tick: {
             count: 2,
             fit:true,
             format: '%HH:%M:%S'
           }
         },
         y: {
           show:true,
           inner:true,
           //max: 4.0,
           tick: {
             count:4,
             //values: [1.0,2.0,3.0,4.0], 
             //values: this.axisY,
             //format: (y) => { return y + "m" }
           }
         }
       },
       legend: {
         show: false
       },
       grid: {
         x: {
           show: true
         },
         y: {
           show: true
         }
       },
       tooltip: {
         //show: false,
         contents: (raw, defaultTitleFormat, defaultValueFormat, color) => {
           if(!this.showLegendValues){
             this.showLegendValues = true;
           }
           this.altTitle = "Avg. processes: " + raw[0].value;
           this.altSubtitle = raw[0].x;

           return '<div style="display:none">' + raw[0].x + '</div>';
         }
       }
     });
  }

  setChartData(evt:CoreEvent){
    console.log("SET LOAD AVG");
    console.log(evt.data);

    this.dataRcvd = true;
    let parsedData = [];
    let dataTypes = [];
    //dataTypes = evt.data.meta.legend;
    //dataTypes.push(evt.data.meta.legend[1]);
    dataTypes = ["shortterm","midterm","longterm"];

    for(let index in dataTypes){
      let chartData:ChartData = {
        legend: dataTypes[index],
        data:[]
      }
      for(let i in evt.data.data){
        chartData.data.push(evt.data.data[i][index])
      }
      parsedData.push(chartData);
    }

    //console.log(parsedData);
    let xColumn = this.makeTimeAxis(evt.data.meta, parsedData);
    //parsedData[0].data.unshift("user");

    this.startTime = this.timeFromDate(xColumn[1]);

    this.endTime = this.timeFromDate(xColumn[xColumn.length - 1]);

    //console.log(xColumn);
    //console.log(parsedData[0].data);

    /*
     // Possible Y axis substitute
     this.chart.ygrids.remove();
     this.maxY = Math.max(...parsedData[0].data.slice(1));
     this.chart.ygrids.add({value: 1, text: this.maxY.toString() + '%', axis: 'y2', position: 'start'})
     console.warn(this.maxY);
     */

    let finalStat = this.aggregateData(["midterm"], parsedData);
    let range = this.yAxisValues(finalStat.data); 
    let cols = this.makeColumns([finalStat]);
    cols.unshift(xColumn);
    this.chart.load({
      columns: cols
    });
    /*this.chart.load({
      columns: [
        xColumn,
        parsedData[1].data // midterm?? This stat doesn't come formatted like the others
      ]
    });*/
    //console.warn(this.chart)
  }

  protected makeTimeAxis(td:TimeData, data:any,  axis?: string):any[]{
    if(!axis){ axis = 'x';}
      let labels: any[] = [axis];
    console.log(td);
    data[0].data.forEach((item, index) =>{
      let date = new Date(td.start * 1000 + index * td.step * 1000);
      labels.push(date);
    });

    return labels;
  }

  yAxisValues(data){
    console.log("**** MAKEAXISRANGE ****");
    console.log(data);
    //data is stored in the array as strings
    //so we convert to floats
    let numbers = data.map(function (x) {
      return parseFloat(x);
    });
    console.log(numbers);
    //Find highest x value
    let highest = Math.max(...numbers);
    console.log(highest);
    //Round up to next whole number
    let max = Math.round(highest);
    console.log(max);
    if(max < 4){
      max = 4.0;
    }

    this.chart.axis.max(max);
    this.chart.internal.yAxisTickValues = [max * 0.25, max * 0.5, max * 0.75, max];
    this.chart.internal.config.axis_y_tick_values = [max * 0.25, max * 0.5, max * 0.75, max];
    this.chart.flush();
    
  }

  /*setCPUData(evt:CoreEvent){
   console.log("SET CPU DATA");
   console.log(evt.data);
   let cpuUserObj = evt.data;

   let parsedData = [];
   let dataTypes = [];
   //dataTypes = evt.data.meta.legend;
   console.log(xColumn);
   dataTypes.push(evt.data.meta.legend[0]);

   for(let index in dataTypes){
     let chartData:ChartData = {
       legend: dataTypes[index],
       data:[]
     }
     for(let i in evt.data.data){
       chartData.data.push(evt.data.data[i][index])
     }
     parsedData.push(chartData);
   }

   this.chartCpu.chartType = 'spline';
   this.chartCpu.units = '%';
   this.chartCpu.timeSeries = true;
   this.chartCpu.timeFormat = '%H:%M';// eg. %m-%d-%Y %H:%M:%S.%L
     this.chartCpu.timeData = evt.data.meta;
   this.chartCpu.data = parsedData;//[cpuUser];
   //this.chartCpu.width = this.chartSize;
   //this.chartCpu.height = 160;

   this.chartCpu.refresh();
   console.log(this.chartCpu);
  }*/

  timeFromDate(date:Date){
    let hh = date.getHours().toString();
    let mm = date.getMinutes().toString();
    let ss = date.getSeconds().toString();

    if(hh.length < 2){
      hh = "0" + hh
    }
    if(mm.length < 2){
      mm = "0" + mm
    }
    if(ss.length < 2){
      ss = "0" + ss
    }
    return hh + ":" + mm + ":" + ss;
  }

  setPreferences(form:NgForm){
    let filtered: string[] = [];
    for(let i in form.value){
      if(form.value[i]){
        filtered.push(i);
      }
    }
  }

}
