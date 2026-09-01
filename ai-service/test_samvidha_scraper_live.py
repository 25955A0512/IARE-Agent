import asyncio
import json
from scrapers.samvidha_scraper import SamvidhaScraper

def test():
    scraper = SamvidhaScraper()
    print("Testing real Samvidha scraper with actual credentials...")
    result = scraper.scrape_timetable('25955A0512', 'GOVIND@232519')
    print("RESULT:")
    print(json.dumps(result, indent=2))

if __name__ == '__main__':
    test()
