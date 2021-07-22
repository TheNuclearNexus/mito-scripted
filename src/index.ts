import * as fs from 'fs';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import {runDatapack} from './datapack'; 

let paths : string[] = ['temp','temp/downloads','output']; // Create folders for later

paths.forEach(element => {
    let stats = fs.statSync(element);
    if(!stats.isDirectory) {
        fs.mkdirSync(element);
    }
});

const argv : any = yargs(hideBin(process.argv)).argv // Init Args

if(argv.datapack) {              // Handle le args
    runDatapack(argv.datapack)
}

