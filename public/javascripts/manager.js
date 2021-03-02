'use strict';

const App = function() {
  return {
    init() {
      Templates.init();
      Contacts.init();
      Tags.init();
      UI.init();
    },
  };
}();

const Templates = function() {
  function compileAndRemove(script) {
    this.list[script.id] = Handlebars.compile(script.innerHTML);
    script.remove();
  }

  function register(partial) {
    Handlebars.registerPartial(partial.id, partial.innerHTML);
  }

  return {
    init() {
      this.list = {};
      this.cache();
    },

    cache() {
      const scripts = document.querySelectorAll("script[type='text/x-handlebars']");
      const partials = document.querySelectorAll('.partial');
      scripts.forEach(compileAndRemove.bind(this));
      partials.forEach(register);
    },
  };
}();

const Contacts = function() {
  return {
    init() {
      this.id = null;
      this.list = [];
      this.edit = false;
      this.blank = {
        full_name: '',
        email: '',
        phone_number: '',
        tags: '',
      };
    },

    getId(button) {
      const li = button.closest('li');
      const phoneNumber = li.querySelector('.phone_number').textContent;
      const email = li.querySelector('.email').textContent;
      let contact;
      let idx;

      for (idx = 0; idx < this.list.length; idx += 1) {
        contact = this.list[idx];
        if (contact['phone_number'] === phoneNumber && contact['email'] === email) {
          return contact['id'];
        }
      }
    },

    lookup(id) {
      let contact;
      let idx;

      for (idx = 0; idx < this.list.length; idx += 1) {
        contact = this.list[idx];
        if (contact['id'] === id) return contact;
      }
    },

    sift(pattern) {
      return this.list.filter(contact => {
        return Object.keys(contact).some(key => {
          if (key === 'id' || !contact[key]) return;
          return contact[key].toLowerCase().includes(pattern);
        });
      });
    },
  };
}();

const Tags = function() {
  function withoutDuplicates(array) {
    const newArray = [];
    array.forEach(element => {
      if (!newArray.includes(element)) newArray.push(element);
    });

    return newArray;
  }

  function isValid(tag) {
    const regex = new RegExp(/[a-z0-9]/, 'gi');
    return tag &&
      typeof tag === 'string' &&
      tag.length > 0 &&
      regex.test(tag);
  }

  function clean(tag) {
    return tag.replace(/[^a-z0-9]/g, '');
  }

  function getTaggedContacts() {
    return Contacts.list.filter(({ tags }) => isValid(tags));
  }

  function getAllTags(contacts) {
    let allTags = contacts.flatMap(contact => {
      let tags = contact['tags']
        .toLowerCase()
        .split(',');
      return tags.map(clean);
    });

    return withoutDuplicates(Tags.list.concat(allTags));
  }

  return {
    init() {
      this.list = [];
    },

    extract() {
      let tagged = getTaggedContacts();
      this.list = getAllTags(tagged);
    },

    add(newTag) {
      if (isValid(newTag)) {
        this.list.push(newTag.toLowerCase());
        this.list = withoutDuplicates(this.list);
        UI.renderTags();
      } else {
        alert('Sorry, that\'s not a valid tag.');
      }
    },

    deselect() {
      let tag;
      let idx;
      for (idx = 0; idx < UI.tagList.children.length; idx += 1) {
        tag = UI.tagList.children[idx];
        tag.classList.remove('selected');
      }
    },
  };
}();

const UI = function() {
  return {
    init() {
      this.getElements();
      this.renderPage();
      this.bindEvents();
    },

    show(element) {
      element.classList.replace('hide', 'show');
    },

    hide(element) {
      element.classList.replace('show', 'hide');
    },

    async renderPage() {
      await API.getContacts();
      Tags.extract();
      this.renderTags();
      this.renderContacts();
      this.renderForm();
    },

    renderTags(tags = Tags.list) {
      const tagsTemplate = Templates.list['tags-template'];
      this.tagList.innerHTML = tagsTemplate({ tags });
    },

    renderContacts(contacts = Contacts.list) {
      const contactsTemplate = Templates.list['contacts-template'];
      this.contactList.innerHTML = contactsTemplate({ contacts });
    },

    renderForm(contact = Contacts.blank) {
      const formTemplate = Templates.list['form-template'];
      this.contactForm.innerHTML = formTemplate(contact);
    },

    getElements() {
      this.contactList = document.getElementById('contact-list');
      this.overlay = document.getElementById('overlay');
      this.contactForm = document.getElementById('contact-form');
      this.search = document.getElementById('search');
      this.searchMessage = document.getElementById('search-message');
      this.tagList = document.getElementById('tag-list');
      this.tagForm = document.getElementById('tag-form');
      this.tagInput = document.getElementById('tag-input');
    },

    bindEvents() {
      document.body.addEventListener('click', Handlers.clickButton.bind(this));
      this.tagList.addEventListener('click', Handlers.clickTag.bind(this));
      this.search.addEventListener('keyup', Handlers.keyup.bind(this));
      this.tagForm.addEventListener('submit', Handlers.submitTagForm.bind(this));
    },
  };
}();

const Handlers = function() {
  function isBackspace(key) {
    return key === 'Backspace';
  }

  function isAlphanumeric(key) {
    const regex = new RegExp(/[a-z0-9 ]/, 'i');
    return regex.test(key) && key.length === 1;
  }

  return {
    clickButton(event) {
      if (event.target.tagName === 'BUTTON') {
        const button = event.target;
        switch (button.id) {
          case 'add-button':
            UI.show(UI.overlay);
            UI.show(UI.contactForm);
            break;
          case 'submit':
            event.preventDefault();
            Contacts.edit ? API.updateContact(Contacts.id) : API.addContact();
          case 'cancel':
            UI.hide(UI.overlay);
            UI.hide(UI.contactForm);
            Contacts.edit = false;
            UI.renderForm();
            break;
          case 'tag-button':
            if (UI.tagInput.value === '') return;
            const submit = new Event('submit');
            UI.tagForm.dispatchEvent(submit);
            break;
          default:
            Contacts.id = Contacts.getId(button);
            if (button.classList.contains('delete')) {
              if (confirm('Are you sure?')) API.deleteContact(Contacts.id);
            } else if (button.classList.contains('edit')) {
              const contact = Contacts.lookup(Contacts.id);
              Contacts.edit = true;
              UI.renderForm(contact);
              UI.show(UI.overlay);
              UI.show(UI.contactForm);
            }
        }
      }
    },

    clickTag(event) {
      if (event.target.tagName === 'LI') {
        if (event.target.classList.contains('selected')) {
          event.target.classList.remove('selected');
          UI.renderContacts();
          UI.hide(UI.searchMessage);
        } else {
          Tags.deselect();
          event.target.classList.add('selected');
          const contacts = Contacts.sift(event.target.textContent);
          UI.renderContacts(contacts);
          if (contacts.length === 0) UI.show(UI.searchMessage);
        }
      }
    },

    keyup(event) {
      const input = event.target;
      if (isBackspace(event.key) || isAlphanumeric(event.key)) {
        if (input.value.length === 0) {
          UI.renderContacts();
          UI.hide(UI.searchMessage);
        } else {
          const contacts = Contacts.sift(input.value);
          UI.renderContacts(contacts);
          contacts.length === 0 ? UI.show(UI.searchMessage) : UI.hide(UI.searchMessage);
        }
      }
    },

    submitTagForm(event) {
      event.preventDefault();
      const newTag = UI.tagInput.value;
      Tags.add(newTag);
      UI.tagForm.reset();
    },
  };
}();

const API = function() {
  function formDataToJSON(formData) {
    if (isInvalidFormData(formData)) return;

    let object = {};
    for (let field of formData) {
      let [ name, value ] = field;
      object[name] = value;
    }

    return JSON.stringify(object);
  }

  function isInvalidFormData(formData) {
    for (let field of formData) {
      let [ name, value ] = field;
      if (name !== 'tags' && value.length === 0) return true;
    }

    return false;
  }

  return {
    async addContact() {
      const formData = new FormData(UI.contactForm);
      const json = formDataToJSON(formData);
      const settings = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: json,
      };
      await fetch('/api/contacts', settings);
      await UI.renderPage();
      alert('The contact has been added.');
    },

    async getContacts() {
      const response = await fetch('/api/contacts');
      const data = await response.json();
      Contacts.list = data;
    },

    async updateContact(id) {
      const formData = new FormData(UI.contactForm);
      const json = formDataToJSON(formData);
      const settings = {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: json
      };
      await fetch(`/api/contacts/${id}`, settings);
      await UI.renderPage();
      alert('The contact has been updated.');
    },

    async deleteContact(id) {
      const settings = {
        method: 'DELETE',
      };
      await fetch(`/api/contacts/${id}`, settings);
      await UI.renderPage();
      alert('The contact has been deleted.');
    },
  };
}();

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});