.PHONY: data fetch clean-data
fetch:
	bash scripts/01_fetch_raw.sh
data:
	python3 scripts/02_clean_facilities.py
	python3 scripts/03_companies.py
	python3 scripts/04_us_growth.py
all: fetch data
clean-data:
	rm -rf data/processed
