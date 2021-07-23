import AdmZip = require('adm-zip');
import * as fs from 'fs';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import {runDatapack} from './datapack'; 
import { dirExists, fileExists } from './util';

let paths : string[] = [
    'temp','temp/downloads',
    'output', 
    'input', 'input/version', 'input/version/data/', 'input/version/data/minecraft', 'input/version/data/minecraft/loot_tables']; // Create folders for later

paths.forEach(element => {
    if(!dirExists(element)) {
        fs.mkdirSync(element);
    }
});

export const argv : any = yargs(hideBin(process.argv)).argv // Init Args

function cloneDir(path: string) {
    let folder = path.replace('temp/', 'input/')
    if(!dirExists(folder))
        fs.mkdirSync(folder)

    fs.readdirSync(path).forEach(f => {
        let pathF = path + f
        if(dirExists(pathF)) {
            cloneDir(pathF + '/')
        } else {
            fs.copyFileSync(pathF, pathF.replace('temp/', 'input/'))
        }
    })

}

if(argv.extractVersion == 'true') {
    if(fileExists('input/version.jar')) {
        console.log('[Setup] Extracting game jar')
        let version = new AdmZip('input/version.jar')
        version.extractAllTo('temp/version')
        console.log('[Setup] Taking what is needed')
        
        cloneDir('temp/version/data/minecraft/loot_tables/')

        console.log('[Setup] Cleaning up unneeded files')
        fs.rmdirSync('temp/version', {recursive: true})
        
    } else {
        console.log(`[Setup] Did not find 'version.jar' in 'input'`)
    }
}


if(argv.datapack) {              // Handle le args
    console.log('[Merger] Starting to merge datapacks')
    runDatapack(argv.datapack)
}