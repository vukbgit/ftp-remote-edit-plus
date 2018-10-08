'use babel';

import path from 'path';
import { decrypt, encrypt, checkPassword } from './../helper/secure.js';
import { $, ScrollView, TextEditorView } from 'atom-space-pen-views';
import { TextBuffer } from 'atom';
import { cleanJsonString } from './../helper/format.js';
import { throwErrorIssue44 } from './../helper/issue.js';
import ConfigurationView from './configuration-view';

//var FileSystem = require('fs-plus');
const atom = global.atom;
const config = require('./../config/folder-schema.json');

export default class FoldersView extends ScrollView {

  static content() {
    return this.div({
      class: 'ftp-remote-edit settings-view overlay from-top',
    }, () => {
      this.div({
        class: 'panels',
      }, () => {
        this.div({
          class: 'panels-item',
        }, () => {
          this.label({
            class: 'icon',
            outlet: 'info',
          });
          this.div({
            class: 'panels-content',
            outlet: 'elements',
          });
        });
      });
      this.div({
        class: 'error-message',
        outlet: 'error',
      });
    });
  }

  constructor() {
    super();

    const self = this;

    self.password = null;
    self.configArray = [];
    self.disableEventhandler = false;
    self.maxId = null;

    let html = '<p>Ftp-Remote-Edit Folder Settings</p>';
    self.info.html(html);

    let saveButton = document.createElement('button');
    saveButton.textContent = 'Save';
    saveButton.classList.add('btn');

    let closeButton = document.createElement('button');
    closeButton.textContent = 'Cancel';
    closeButton.classList.add('btn');
    closeButton.classList.add('pull-right');

    self.elements.append(self.createFoldersSelect());
    self.elements.append(self.createRequiredDiv());

    self.elements.append(saveButton);
    self.elements.append(closeButton);

    // Events
    closeButton.addEventListener('click', (event) => {
      self.close();
    });

    saveButton.addEventListener('click', (event) => {
      self.save();
      self.close();
    });

    // testButton.addEventListener('click', (event) => {
    //   self.test();
    // });

    atom.commands.add(this.element, {
      'core:confirm': () => {
        // self.save();
      },
      'core:cancel': () => {
        self.cancel();
      },
    });
  }

  createRequiredDiv() {
    const self = this;

    let nameLabel = document.createElement('label');
    nameLabel.classList.add('control-label');
    let nameLabelTitle = document.createElement('div');
    nameLabelTitle.textContent = 'The name of the server.';
    nameLabelTitle.classList.add('setting-title');
    nameLabel.appendChild(nameLabelTitle);
    self.nameInput = new TextEditorView({ mini: true, placeholderText: "name" });

    let divRequired = document.createElement('div');
    divRequired.classList.add('requiredDiv');

    let nameControl = document.createElement('div');
    nameControl.classList.add('controls');
    nameControl.classList.add('name');
    nameControl.appendChild(nameLabel);
    nameControl.appendChild(self.nameInput.element);

    let folderGroup = document.createElement('div');
    folderGroup.classList.add('control-group');
    folderGroup.appendChild(nameControl);
    divRequired.appendChild(folderGroup);

    // Events
    self.nameInput.getModel()
      .onDidChange(() => {
        if (self.configArray.length !== 0 && !self.disableEventhandler) {
          let index = self.getFolderIndexById(self.selectFolder.selectedOptions[0].value);
          self.configArray[index].name = self.nameInput.getText()
            .trim();
          self.selectFolder.selectedOptions[0].text = self.nameInput.getText()
            .trim();
        }
      });

    return divRequired;
  }

  getFolderIndexById(id) {
      const self = this;
      id = parseInt(id, 10);
      folderIndex = false;
      self.configArray.forEach((item, index) => {
        if (item.id == id) {
            folderIndex = index;
        }
      });
      return folderIndex;
  }

  createFoldersSelect() {
    const self = this;

    let div = document.createElement('div');
    div.style.marginBottom = '20px';

    let selectContainer = document.createElement('div');
    selectContainer.classList.add('select-container');

    let select = document.createElement('select');
    select.classList.add('form-control');
    selectContainer.appendChild(select);
    self.selectFolder = select;
    self.selectFolder.focus();

    let newButton = document.createElement('button');
    newButton.textContent = 'New';
    newButton.classList.add('btn');

    let deleteButton = document.createElement('button');
    deleteButton.textContent = 'Delete';
    deleteButton.classList.add('btn');
    deleteButton.classList.add('pull-right');

    div.appendChild(selectContainer);
    selectContainer.appendChild(newButton);
    selectContainer.appendChild(deleteButton);

    // Events
    select.addEventListener('change', (event) => {
      if (self.configArray.length !== 0 && !self.disableEventhandler) {
        let option = event.currentTarget.selectedOptions[0];
        self.nameInput.setText(option.text);
      }
    });

    newButton.addEventListener('click', (event) => {
      self.new();
    });

    deleteButton.addEventListener('click', (event) => {
      self.delete();
    });

    div.classList.add('controls');

    return div;
  }

  loadConfig(loadConfig) {
    const self = this;

    let configText = atom.config.get('ftp-remote-edit-plus.folders');
    let configArray = [];

    if (configText) {
      try {
        configText = JSON.stringify(JSON.parse(cleanJsonString(configText)), null, 4);
      } catch (e) {
        configText = decrypt(self.password, configText);
      }
      try {
        configArray = JSON.parse(cleanJsonString(configText));
        configArray.forEach((item, index) => {
          let cleanconfig = JSON.parse(JSON.stringify(config));
          if (!item.name) item.name = cleanconfig.name + " " + (index + 1);
        });

        configArray.sort((a, b) => {
          if (a.name.toLowerCase() < b.name.toLowerCase()) return -1;
          if (a.name.toLowerCase() > b.name.toLowerCase()) return 1;
          return 0;
        });
      } catch (e) {
          throwErrorIssue44(e, self.password);
        self.close();
      }
    }
    return configArray;
  }

  reload(loadConfig, selectedFolder) {
    const self = this;

    if (!self.password) {
      return;
    }

    self.disableEventhandler = true;

    if (self.selectFolder.options.length > 0) {
      for (i = self.selectFolder.options.length - 1; i >= 0; i--) {
        self.selectFolder.remove(i);
      }
    }

    // Load config
    if (loadConfig) {
      self.configArray = self.loadConfig();
    }
    let selectedIndex = 0;
    self.maxId = 0;
    if (self.configArray.length !== 0) {
      self.configArray.forEach((item, index) => {
        let option = document.createElement("option");
        option.value = item.id;
        option.text = item.name;
        //set maxId
        if(item.id && item.id > self.maxId) {
            self.maxId = item.id;
        }
        self.selectFolder.add(option);

        if (selectedFolder) {
          if (selectedFolder.config.host == item.host && selectedFolder.config.name == item.name) {
            selectedIndex = index;
          }
        }
      });

      self.selectFolder.selectedIndex = selectedIndex;
      self.nameInput.setText(self.configArray[selectedIndex].name);

      // Enable Input Fields
      self.enableInputFields();
    } else {
      self.nameInput.setText('');

      // Disable Input Fields
      self.disableInputFields();
    }
    self.disableEventhandler = false;
  };

  attach() {
    this.panel = atom.workspace.addModalPanel({
      item: this
    });
  };

  close() {
    const self = this;

    self.configArray = [];
    const destroyPanel = this.panel;
    this.panel = null;
    if (destroyPanel) {
      destroyPanel.destroy();
    }

    atom.workspace.getActivePane()
      .activate();
  }

  cancel() {
    this.close();
  }

  showError(message) {
    this.error.text(message);
    if (message) {
      this.flashError();
    }
  }

  enableInputFields() {
    const self = this;

    self.nameInput[0].classList.remove('disabled');
    self.nameInput.disabled = false;

  }

  disableInputFields() {
    const self = this;

    self.nameInput[0].classList.add('disabled');
    self.nameInput.disabled = true;

    let changing = false;
    self.nameInput.getModel()
      .onDidChange(() => {
        if (!changing && self.nameInput.disabled) {
          changing = true;
          self.nameInput.setText('');
          changing = false;
        }
      });
  }

  new() {
    const self = this;

    self.enableInputFields();

    let newconfig = JSON.parse(JSON.stringify(config));
    self.maxId++;
    newconfig.id = self.maxId;
    newconfig.name = config.name + " " + (self.configArray.length + 1);
    self.configArray.push(newconfig);

    let option = document.createElement('option');
    option.text = newconfig.name;
    option.value = newconfig.id;

    this.selectFolder.add(option);
    this.selectFolder.value = newconfig.id;
    this.selectFolder.dispatchEvent(new Event('change'));
  }

  save(configArray) {
    const self = this;
    if(configArray) {
        self.configArray = configArray;
    }
    if (self.configArray.length > 0) {
      atom.config.set('ftp-remote-edit-plus.folders', encrypt(self.password, JSON.stringify(self.configArray)));
    } else {
      atom.config.set('ftp-remote-edit-plus.folders', '');
    }
    self.close();
  }

  delete() {
    const self = this;

    if (self.configArray.length == 0) return;
    let folderId = self.selectFolder.selectedOptions[0].value;
    let folderIndex = self.getFolderIndexById(folderId);
    self.configArray.splice(folderIndex, 1);
    //update servers
    configurationView = new ConfigurationView();
    configurationView.password = self.password;
    servers = configurationView.loadConfig();
    servers.forEach((item, index) => {
      if (item.folder == folderId) {
          servers[index].folder = null;
      }
    });
    configurationView.save(servers);
    self.reload();
  }
}
